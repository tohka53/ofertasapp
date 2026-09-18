import { expect, test } from '@playwright/test';
import { loginWithDemo } from './helpers';

test.describe('Acceso de demostración', () => {
  test('protege las rutas y valida el formulario', async ({ page }) => {
    await page.goto('/buscar');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Acceso de demostración.')).toBeVisible();
    await expect(page.getByText('Versión de prueba: tus listas y preferencias se perderán al recargar o cerrar sesión')).toBeVisible();

    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Ingresa tu correo electrónico')).toBeVisible();
    await expect(page.getByText('Ingresa tu contraseña')).toBeVisible();

    await page.getByLabel('Correo electrónico').fill('correo-invalido');
    await page.getByLabel('Contraseña', { exact: true }).fill('x');
    await expect(page.getByText('El correo no tiene un formato válido')).toBeVisible();

    await page.getByLabel('Correo electrónico').fill('demo@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('Incorrecta1!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('el botón "Usar usuario de prueba" completa el formulario', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Usar usuario de prueba' }).click();
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('demo@example.com');
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('Demo123!');
  });

  for (const [email, password] of [
    ['demo@example.com', 'Demo123!'],
    ['ana@example.com', 'Ana123!'],
    ['carlos@example.com', 'Carlos123!'],
  ] as const) {
    test(`inicia sesión con ${email} y la recarga cierra la sesión`, async ({ page }) => {
      await loginWithDemo(page, email, password);
      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});
