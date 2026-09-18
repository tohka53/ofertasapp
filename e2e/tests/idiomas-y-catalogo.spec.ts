import { expect, test, type Page } from '@playwright/test';
import { loginWithDemo, search, setupGuatemala, storeRow } from './helpers';

function languageToggle(page: Page, lang: 'es' | 'en') {
  return page.locator(`app-language-switch mat-button-toggle[lang="${lang}"] button`).first();
}

test('cambia entre español e inglés en tiempo real sin perder la sesión ni los resultados', async ({ page }) => {
  await page.goto('/login');
  await languageToggle(page, 'en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Sign in · ComparAhorro');
  await page.getByRole('button', { name: 'Use test user' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/configurar\/pais$/);
  await expect(page.getByRole('heading', { name: 'Which country do you shop in?' })).toBeVisible();
  await expect(page.locator('[data-country="GT"]')).toContainText('9 registered stores · 4 with integration · currency GTQ');

  await page.locator('[data-country="GT"]').click();
  await page.getByRole('button', { name: 'Select all available' }).click();
  await expect(page.getByText('5 selected · 3 available to query and 2 with a link of 9 registered')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save and search' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
  await expect(page.getByText('Store catalogs in Guatemala are in Spanish')).toBeVisible();

  await page.getByLabel('What product are you looking for?').fill('leche');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('3 of 3 stores queried responded')).toBeVisible();
  const card = page.locator('app-offer-card', { hasText: 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml' });
  await expect(card).toContainText('Q 19.98 per liter');
  await expect(card).toContainText('Lowest price found across your stores');
  await expect(page.locator('[data-link-store="pricesmart-gt"] a')).toContainText('Search “leche” on PriceSmart');

  await languageToggle(page, 'es').click();
  await expect(page.getByText('Respondieron 3 de 3 tiendas consultadas')).toBeVisible();
  await expect(card).toContainText('Q 19.98 por litro');
  await expect(page).toHaveTitle('Buscar productos · ComparAhorro');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('EE. UU.: se elige el estado y se muestran las cadenas que operan en él', async ({ page }) => {
  await loginWithDemo(page);
  await page.locator('[data-country="US"]').click();
  await expect(page).toHaveURL(/\/configurar\/estado$/);
  await page.getByLabel('Buscar estado').fill('ohio');
  await page.locator('[data-state="OH"]').click();
  await expect(page).toHaveURL(/\/configurar\/tiendas$/);
  await expect(page.getByRole('heading', { name: 'Elige tus tiendas en Ohio' })).toBeVisible();

  await expect(storeRow(page, 'kroger-us')).toContainText('Faltan credenciales');
  await expect(storeRow(page, 'meijer-us')).toContainText('Integración pendiente');
  await expect(storeRow(page, 'publix-us')).toHaveCount(0);
  await expect(page.getByText('Ninguna tienda de Ohio se puede consultar ni enlazar desde la app todavía')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();

  await storeRow(page, 'kroger-us').getByText('¿Por qué está pendiente?').click();
  await expect(storeRow(page, 'kroger-us')).toContainText('KROGER_CLIENT_ID');

  await page.getByRole('link', { name: 'Cambiar estado' }).click();
  await page.locator('[data-state="FL"]').click();
  await expect(page.getByRole('heading', { name: 'Elige tus tiendas en Florida' })).toBeVisible();
  await expect(storeRow(page, 'publix-us')).toContainText('Integración pendiente');
});

test('PriceSmart: abre su búsqueda y el precio anotado queda marcado en la lista', async ({ page }) => {
  await setupGuatemala(page);
  await search(page, 'arroz');
  await expect(page.getByRole('heading', { name: 'Resumen de “arroz”' })).toBeVisible();
  await expect(page.locator('[data-link-store="pricesmart-gt"] a')).toHaveAttribute('href', 'https://www.pricesmart.com/es-gt/busqueda?q=arroz');

  await page.getByRole('button', { name: 'Anotar precio de PriceSmart' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Producto')).toHaveValue('arroz');
  await dialog.getByLabel('Precio (Q)').fill('25.50');
  await dialog.getByLabel('Presentación (opcional)').fill('2 lb');
  await dialog.getByLabel('Cantidad').fill('2');
  await dialog.getByRole('button', { name: 'Guardar precio' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Precio anotado en “Compras de/)).toBeVisible();

  await page.getByRole('link', { name: 'Mis listas' }).first().click();
  await page.locator('a.list-card').first().click();
  await expect(page.getByTestId('list-total')).toHaveText('Q 51.00');
  const row = page.locator('li.item', { hasText: 'arroz' });
  await expect(row).toContainText('Precio anotado por vos');
  await expect(row).toContainText('no verificado por la app');
  await expect(page.getByText('1 precio anotado por vos')).toBeVisible();

  await page.getByRole('button', { name: 'Actualizar precios' }).click();
  await expect(page.getByText('No hay artículos cotizados en tiendas consultadas para actualizar')).toBeVisible();
});
