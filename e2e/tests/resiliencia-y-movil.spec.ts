import { expect, test, type Page } from '@playwright/test';
import { addOfferToList, search, setupGuatemala } from './helpers';

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'la página no debe desplazarse horizontalmente').toBeLessThanOrEqual(1);
}

test.describe('Resiliencia', () => {
  test('una tienda que falla no detiene a las demás ni genera precios ficticios', async ({ page }) => {
    await setupGuatemala(page);
    await search(page, 'leche falla');
    const status = page.locator('app-store-query-status');
    await expect(status).toContainText('Respondieron 2 de 3 tiendas consultadas');
    await expect(status).toContainText('Maxi Despensa: temporalmente sin conexión');
    await expect(page.locator('app-offer-card', { hasText: 'Maxi Despensa' })).toHaveCount(0);
    await expect(page.locator('app-offer-card', { hasText: 'Walmart Guatemala' }).first()).toBeVisible();
  });

  test('una búsqueda nueva cancela la anterior y sus resultados no la reemplazan', async ({ page }) => {
    await setupGuatemala(page);
    await search(page, 'leche lento');
    await expect(page.getByText('Consultando “leche lento”')).toBeVisible();
    await search(page, 'arroz');
    await expect(page.getByRole('heading', { name: 'Resumen de “arroz”' })).toBeVisible();
    // La consulta lenta tarda 4 s; pasado ese tiempo la pantalla sigue mostrando "arroz".
    await page.waitForTimeout(4500);
    await expect(page.getByRole('heading', { name: 'Resumen de “arroz”' })).toBeVisible();
    await expect(page.getByText('Resumen de “leche lento”')).toHaveCount(0);
  });

  test('recargar la página elimina sesión, preferencias y listas', async ({ page }) => {
    await setupGuatemala(page);
    await search(page, 'leche');
    await expect(page.getByText('Respondieron 3 de 3 tiendas consultadas')).toBeVisible();
    await addOfferToList(page, 'Leche Entera Suli UHT - 1 L', 2);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('button', { name: 'Usar usuario de prueba' }).click();
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/configurar\/pais$/);
    await page.goto('/listas');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Teléfono @movil', () => {
  test('navegación inferior y pantallas sin desplazamiento horizontal @movil', async ({ page }) => {
    await setupGuatemala(page);
    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
    await search(page, 'leche');
    await expect(page.getByText('Respondieron 3 de 3 tiendas consultadas')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByText('Filtros y orden').click();
    await expect(page.getByRole('switch', { name: 'Solo disponibles' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Ver comparación' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('Mismo producto en tus tiendas');
    await expectNoHorizontalScroll(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

    await addOfferToList(page, 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml', 2);
    await page.locator('.bottom-nav').getByRole('link', { name: 'Mis listas' }).click();
    await page.locator('a.list-card').first().click();
    await expect(page.getByTestId('list-total')).toHaveText('Q 37.80');
    await expectNoHorizontalScroll(page);

    await page.locator('.bottom-nav').getByRole('link', { name: 'Perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.locator('.bottom-nav').getByRole('link', { name: 'Ofertas' }).click();
    await expect(page.locator('app-store-query-status')).toContainText('Respondieron 3 de 3 tiendas consultadas');
    await expectNoHorizontalScroll(page);
  });
});
