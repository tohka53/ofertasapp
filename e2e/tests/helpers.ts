import { expect, type Page } from '@playwright/test';

export async function loginWithDemo(page: Page, email?: string, password?: string): Promise<void> {
  await page.goto('/login');
  if (email && password) {
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
  } else {
    await page.getByRole('button', { name: 'Usar usuario de prueba' }).click();
  }
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/configurar\/pais$/);
}

/** Login → Guatemala → todas las tiendas disponibles → ubicación por defecto → buscador. */
export async function setupGuatemala(page: Page): Promise<void> {
  await loginWithDemo(page);
  await page.locator('[data-country="GT"]').click();
  await expect(page).toHaveURL(/\/configurar\/tiendas$/);
  await page.getByRole('button', { name: 'Seleccionar todas las disponibles' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/configurar\/ubicacion$/);
  await page.getByRole('button', { name: 'Guardar y buscar' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
}

export async function search(page: Page, term: string): Promise<void> {
  await page.getByLabel('¿Qué producto buscas?').fill(term);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
}

/** Fila de una tienda en el selector, por su identificador (no por texto: los detalles pueden nombrar otras tiendas). */
export function storeRow(page: Page, id: string) {
  return page.locator('app-store-selector li.store').filter({ has: page.locator(`[data-store="${id}"]`) });
}

export function offerCard(page: Page, name: string) {
  return page.locator('app-offer-card', { hasText: name });
}

export async function addOfferToList(page: Page, name: string, quantity: number, listName?: string): Promise<void> {
  await offerCard(page, name).getByRole('button', { name: 'Añadir a mi lista' }).click();
  const dialog = page.getByRole('dialog');
  if (listName) {
    await dialog.getByLabel('Nombre de la nueva lista').fill(listName);
  }
  await dialog.getByLabel('Cantidad').fill(String(quantity));
  await dialog.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(dialog).toBeHidden();
}
