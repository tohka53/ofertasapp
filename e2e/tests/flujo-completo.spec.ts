import { expect, test } from '@playwright/test';
import { addOfferToList, loginWithDemo, offerCard, search, setupGuatemala, storeRow } from './helpers';

test('flujo completo: país, tiendas, búsqueda, comparación, lista mensual y perfil', async ({ page }) => {
  // 1) Acceso y país
  await loginWithDemo(page);
  await expect(page.locator('[data-country="GT"]')).toContainText('9 tiendas registradas · 4 con integración');
  await expect(page.locator('[data-country="SV"]')).toContainText('6 tiendas registradas · 3 con integración');
  await expect(page.locator('[data-country="US"]')).toContainText('Tiendas por estado');
  await page.locator('[data-country="GT"]').click();

  // 2) Tiendas: consultables, solo enlace, sin conexión y pendientes; buscador y selección múltiple
  const storesList = page.locator('app-store-selector');
  await expect(storeRow(page, 'walmart-gt')).toContainText('Disponible para consultar');
  await expect(storeRow(page, 'paiz-gt')).toContainText('Temporalmente sin conexión');
  await expect(storeRow(page, 'pricesmart-gt')).toContainText('Solo enlace a su sitio');
  await expect(storeRow(page, 'suma-gt')).toContainText('Solo enlace a su sitio');
  await expect(storeRow(page, 'despensa-familiar-gt')).toContainText('Integración pendiente');
  await expect(storesList.locator('[data-store="pricesmart-gt"] input')).toBeEnabled();
  await expect(storesList.locator('[data-store="despensa-familiar-gt"] input')).toBeDisabled();
  await page.getByLabel('Buscar tienda por nombre').fill('torre');
  await expect(storesList.locator('li.store')).toHaveCount(1);
  await page.getByLabel('Buscar tienda por nombre').fill('');
  await page.getByRole('button', { name: 'Seleccionar todas las disponibles' }).click();
  await expect(page.getByText('5 seleccionadas · 3 disponibles para consultar y 2 con enlace de 9 registradas')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // 3) Ubicación: se pide porque Walmart publica precios por ubicación
  await expect(page.getByText('precios distintos según la ubicación')).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar sucursal asignada' }).click();
  await expect(page.locator('app-location-picker')).toContainText('Walmart Guatemala: sucursal WM-DEL NORTE');
  await page.getByRole('button', { name: 'Guardar y buscar' }).click();
  await expect(page).toHaveURL(/\/buscar$/);
  await expect(page.getByText('Guatemala Zona 1 (01001) · por defecto')).toBeVisible();

  // 4) Búsqueda real simulada y comparación entre tiendas
  await search(page, 'leche');
  await expect(page.getByText('Respondieron 3 de 3 tiendas consultadas')).toBeVisible();

  // Tiendas sin consulta automática: enlace a la búsqueda comprobada de PriceSmart y al sitio de SUMA
  await expect(page.locator('[data-link-store="pricesmart-gt"] a')).toHaveAttribute('href', 'https://www.pricesmart.com/es-gt/busqueda?q=leche');
  await expect(page.locator('[data-link-store="suma-gt"] a')).toHaveAttribute('href', 'https://www.suma.com.gt/');
  const groups = page.locator('app-comparison-groups');
  await expect(groups).toContainText('Mismo código de barras');
  await expect(groups.locator('li.best')).toContainText('Walmart Guatemala');
  await expect(groups.locator('li.best')).toContainText('Q 18.90');
  await expect(groups.locator('li', { hasText: 'La Torre' })).toContainText('Q 20.65');
  await expect(page.locator('.summary')).toContainText('Menor precio por paquete');
  await expect(page.locator('.summary')).toContainText('Menor precio por litro');

  // Precio por unidad y distintivo en la tarjeta
  const delactomy = offerCard(page, 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml');
  await expect(delactomy).toContainText('Q 19.98 por litro');
  await expect(delactomy).toContainText('Menor precio encontrado entre tus tiendas');
  await expect(delactomy).toContainText('WM-DEL NORTE');

  // Una tarjeta con presentación ambigua no muestra precio por unidad inventado
  await expect(offerCard(page, 'Leche Deslactosada Coronado Caja 12 Unidades - 12 L')).toContainText('Precio por unidad: No disponible');

  await page.getByRole('button', { name: 'Ver comparación' }).first().click();
  const compare = page.getByRole('dialog');
  await expect(compare).toContainText('Mismo producto en tus tiendas');
  await expect(compare).toContainText('Las tiendas reportan contenidos distintos');
  await expect(compare.locator('li.best')).toContainText('Walmart Guatemala');
  await compare.getByRole('button', { name: 'Cerrar' }).click();

  // Producto sin ofertas comparables
  await offerCard(page, 'Leche Entera Winter Instantánea - 360 g').getByRole('button', { name: 'Comparar' }).click();
  await expect(compare).toContainText('No hay suficientes ofertas para comparar');
  await compare.getByRole('button', { name: 'Buscar este código de barras en tus tiendas' }).click();
  await expect(compare).toContainText('Respondieron 3 de 3 tiendas consultadas');
  await expect(compare).toContainText('No hay suficientes ofertas para comparar');
  await compare.getByRole('button', { name: 'Cerrar' }).click();

  // Filtros y orden
  await page.getByRole('switch', { name: 'Solo con promoción' }).click();
  await expect(page.getByRole('heading', { name: /de 17 resultados/ })).toContainText('8 de 17');
  await page.getByRole('switch', { name: 'Solo con promoción' }).click();
  await page.getByLabel('Máximo').fill('15');
  await page.getByLabel('Máximo').blur();
  await expect(page.getByRole('heading', { name: /de 17 resultados/ })).toContainText('3 de 17');
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();

  // 5) Añadir ofertas a una lista mensual
  await addOfferToList(page, 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml', 2);
  await expect(page.getByText(/Añadido a "Compras de/)).toBeVisible();
  await addOfferToList(page, 'Leche Entera Suli UHT - 1 L', 3);
  await addOfferToList(page, 'Leche UHT Descremada Delactomy', 1);

  await page.getByRole('link', { name: 'Mis listas' }).first().click();
  await expect(page.locator('a.list-card')).toContainText('Q 97.45');
  await page.locator('a.list-card').first().click();

  const total = page.getByTestId('list-total');
  await expect(total).toHaveText('Q 97.45'); // 18.90×2 + 13.00×3 + 20.65×1
  await expect(page.locator('section.store-group')).toHaveCount(3);

  // Cambiar cantidad y marcar comprado
  const suliRow = page.locator('li.item', { hasText: 'Leche Entera Suli UHT - 1 L' });
  await suliRow.getByLabel('Cantidad').fill('4');
  await suliRow.getByLabel('Cantidad').blur();
  await expect(total).toHaveText('Q 110.45');
  await expect(suliRow.getByTestId('line-subtotal')).toHaveText('Q 52.00');
  await page.locator('li.item', { hasText: 'Leche Dos Pinos delactomy uht 0% grasa - 946 ml' }).getByRole('checkbox').check();
  await expect(page.getByTestId('list-remaining')).toHaveText('Q 72.65');

  // Necesidad manual pendiente de cotizar (no suma como gratuita)
  await page.getByRole('button', { name: 'Añadir artículo' }).click();
  const itemDialog = page.getByRole('dialog');
  await itemDialog.getByLabel('Producto', { exact: true }).fill('arroz');
  await itemDialog.getByLabel('Presentación deseada (opcional)').fill('400 g');
  await itemDialog.getByLabel('Cantidad').fill('2');
  await itemDialog.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByText('Pendientes de cotizar (1)')).toBeVisible();
  await expect(page.getByText('1 pendiente de cotizar (no suma)')).toBeVisible();
  await expect(total).toHaveText('Q 110.45');

  // Buscar mejores precios para el pendiente y confirmar la oferta elegida
  await page.getByRole('button', { name: 'Buscar mejores precios' }).click();
  const best = page.getByRole('dialog');
  await expect(best).toContainText('Artículo 1 de 1');
  const firstOption = best.locator('label.option').first();
  await expect(firstOption).toContainText('Arroz Arroz Precocido Parborizado Empaque - 400 g');
  await expect(firstOption).toContainText('Coincide con la presentación deseada');
  await firstOption.locator('input[type="radio"]').check();
  await best.getByRole('button', { name: 'Elegir y terminar' }).click();
  await expect(total).toHaveText('Q 124.75'); // + 7.15 × 2
  await expect(page.locator('#pendientes')).toHaveCount(0);

  // Actualizar precios: propone la misma leche más barata en otra tienda y pide confirmación
  await page.getByRole('button', { name: 'Actualizar precios' }).click();
  const refresh = page.getByRole('dialog');
  const alternative = refresh.locator('li', { hasText: 'Más barato en otra tienda' });
  await expect(alternative).toContainText('Leche UHT Descremada Delactomy');
  await expect(alternative).toContainText('Walmart Guatemala');
  await expect(alternative.getByRole('checkbox')).not.toBeChecked();
  await alternative.getByRole('checkbox').check();
  await refresh.getByRole('button', { name: 'Aplicar cambios seleccionados' }).click();
  await expect(refresh).toBeHidden();
  await expect(page.locator('section.store-group')).toHaveCount(2); // La Torre desaparece
  await expect(total).toHaveText('Q 123.00'); // 20.65 → 18.90

  // Eliminar un artículo
  await page.locator('li.item', { hasText: 'Arroz Arroz Precocido' }).getByRole('button', { name: 'Eliminar artículo' }).click();
  await expect(total).toHaveText('Q 108.70'); // − 7.15 × 2

  // 6) Perfil: modificar tiendas y ubicación, aplicado de inmediato
  await page.getByRole('link', { name: 'Perfil' }).first().click();
  await expect(page.getByText('demo@example.com').first()).toBeVisible();
  await page.locator('app-store-selector [data-store="maxi-despensa-gt"]').getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Guardar tiendas' }).click();
  await page.locator('mat-button-toggle', { hasText: 'Código postal' }).click();
  await page.getByLabel('Código postal (5 dígitos)').fill('13001');
  await page.getByRole('button', { name: 'Aplicar ubicación' }).click();
  await expect(page.getByText('Actual: Código postal 13001')).toBeVisible();

  await page.getByRole('link', { name: 'Buscar productos' }).first().click();
  await expect(page.getByText('Respondieron 2 de 2 tiendas consultadas')).toBeVisible();
  await expect(page.locator('app-store-query-status')).toContainText('no asignó una sucursal');

  // 7) Cambio de país: tiendas de nuevo y listas separadas por país
  await page.getByRole('link', { name: 'Perfil' }).first().click();
  await page.getByLabel('País de compra').click();
  await page.getByRole('option', { name: /El Salvador/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cambiar país' }).click();
  await expect(page).toHaveURL(/\/configurar\/tiendas$/);
  await expect(storeRow(page, 'walmart-sv')).toContainText('Temporalmente sin conexión');
  await expect(storeRow(page, 'pricesmart-sv')).toContainText('Solo enlace a su sitio');
  await expect(storeRow(page, 'super-selectos-sv')).toContainText('Integración pendiente');

  await page.goto('/configurar/pais');
  await expect(page).toHaveURL(/\/login$/); // navegación con recarga: la sesión en memoria se pierde
});

test('cerrar sesión borra los datos y otro usuario no los hereda', async ({ page }) => {
  await setupGuatemala(page);
  await search(page, 'leche');
  await expect(page.getByText('Respondieron 3 de 3 tiendas consultadas')).toBeVisible();
  await addOfferToList(page, 'Leche Entera Suli UHT - 1 L', 1);

  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await loginWithDemo(page, 'ana@example.com', 'Ana123!');
  await page.locator('[data-country="GT"]').click();
  await page.getByRole('button', { name: 'Seleccionar todas las disponibles' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Guardar y buscar' }).click();
  await expect(page.getByText('Empieza con una búsqueda')).toBeVisible();
  await page.getByRole('link', { name: 'Mis listas' }).first().click();
  await expect(page.getByText('Aún no tienes listas')).toBeVisible();
});
