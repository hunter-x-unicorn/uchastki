import { test, expect, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDemo, createEntrance, EMPTY_DATA, serializeBackup } from '../../src/model';
import { archiveEntity } from '../../src/lifecycle';
const apartment = (page: Page, number: string) =>
  page.getByRole('button', {
    name: new RegExp(`^Квартира ${number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`),
  });
async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Создать первый участок', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await page.getByLabel('Название участка', { exact: true }).fill('Тестовый участок');
  await page.getByRole('button', { name: 'Создать участок', exact: true }).click();
  await page.getByRole('button', { name: 'Создать подъезд', exact: true }).click();
  await expect(page.getByLabel('Квартир на этаже', { exact: true })).toHaveValue('4');
  await page.getByLabel('Количество этажей', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Создать подъезд и квартиры', exact: true }).click();
  await expect(apartment(page, '4')).toBeVisible();
}
async function action(page: Page, number: string, label: string) {
  await apartment(page, number).click();
  await page.getByRole('button', { name: 'Меню квартиры', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}
async function openArchive(page: Page) {
  await page.getByRole('button', { name: 'Настройки и резервная копия', exact: true }).click();
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
}
test('centered forms, rectangular menu, detailed data through pencil and independent markers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await create(page);
  await apartment(page, '1').click();
  const first = await page.getByRole('button', { name: 'Не застали', exact: true }).boundingBox();
  const second = await page.getByRole('button', { name: 'Отказ', exact: true }).boundingBox();
  const third = await page.getByRole('button', { name: 'Повтор', exact: true }).boundingBox();
  expect(first!.width).toBeGreaterThan(first!.height);
  expect(second!.y).toBeCloseTo(first!.y, 0);
  expect(third!.y).toBeGreaterThan(first!.y);
  await expect(page.getByRole('button', { name: 'Сведения о квартире', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText(/^Не застали: /)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Нет звонка', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Нет звонка', exact: true })).toBeChecked();
  await page.screenshot({ path: 'artifacts/new-apartment-menu.png', animations: 'disabled' });
  await page.getByRole('checkbox', { name: 'Отметка карандашом', exact: true }).click();
  await page.getByLabel('Имя или обращение', { exact: true }).fill('Андрей');
  await page.getByLabel('Телефон', { exact: true }).fill('+375 29 1234567');
  await page.getByLabel('Когда зайти повторно', { exact: true }).fill('Вечером');
  await page.getByLabel('Дополнительные сведения', { exact: true }).fill('Подробная заметка');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(apartment(page, '1').getByTestId('apartment-marker-pencil')).toBeVisible();
  await expect(apartment(page, '1').getByTestId('apartment-marker-noBell')).toBeVisible();
  await apartment(page, '1').click();
  await page.getByRole('button', { name: 'Не застали', exact: true }).click();
  await page.reload();
  await action(page, '1', 'Изменить');
  await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('+375 29 1234567');
  await page.screenshot({ path: 'artifacts/new-apartment-details.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  expect(errors).toEqual([]);
});
test('four normal slots, fifth shrinks, six maximum, overflow below, fewer than four keep width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const entrance = createEntrance({
    name: 'Подъезд 1',
    floors: 1,
    perFloor: 4,
    firstNumber: 1,
    firstFloor: 1,
  });
  const data = {
    ...EMPTY_DATA,
    territories: [{ id: 'territory', name: 'Сетка', address: '', entrances: [entrance] }],
  };
  await page.addInitScript(
    (value) => localStorage.setItem('uchastki:data:v1', value),
    JSON.stringify(data),
  );
  await page.goto('/?territory=territory&entrance=' + entrance.id);
  const normal = await apartment(page, '1').boundingBox();
  expect(normal!.width).toBeGreaterThan(60);
  expect(normal!.height).toBeCloseTo(normal!.width, 0);
  await action(page, '1', 'Разделить');
  const five = await apartment(page, '1').boundingBox();
  expect(five!.width).toBeLessThan(normal!.width);
  expect((await apartment(page, '1/2').boundingBox())!.y).toBeCloseTo(five!.y, 0);
  await action(page, '1', 'Разделить');
  const six = await apartment(page, '1').boundingBox();
  expect(six!.width).toBeGreaterThan(40);
  expect(six!.height).toBeCloseTo(six!.width, 0);
  expect(six!.width).toBeLessThan(five!.width);
  await action(page, '1', 'Разделить');
  const bottom = await apartment(page, '4').boundingBox();
  expect(bottom!.y).toBeGreaterThan(six!.y);
  await page.screenshot({ path: 'artifacts/new-grid-seven.png', animations: 'disabled' });
  // A separate isolated seed with three apartments retains the four-column cell size.
  const fewer = {
    ...data,
    territories: [
      {
        ...data.territories[0],
        entrances: [{ ...entrance, apartments: entrance.apartments.slice(0, 3) }],
      },
    ],
  };
  await page.evaluate(
    (value) => localStorage.setItem('uchastki:data:v1', value),
    JSON.stringify(fewer),
  );
  // Check the fixture in a new page with no initial-script override.
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 320, height: 720 });
  await other.goto('/?territory=territory&entrance=' + entrance.id);
  await expect
    .poll(async () => (await apartment(other, '1').boundingBox())!.width)
    .toBeCloseTo(normal!.width, 0);
  expect(await other.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await other.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => (await apartment(other, '1').boundingBox())!.width)
    .toBeGreaterThan(normal!.width);
  await other.setViewportSize({ width: 320, height: 720 });
  await expect
    .poll(async () => (await apartment(other, '1').boundingBox())!.width)
    .toBeCloseTo(normal!.width, 0);
  await other.close();
});
test('deletions require confirmation, clear preserves notes, archive restores records', async ({
  page,
}) => {
  await create(page);
  await apartment(page, '1').click();
  await page.getByRole('button', { name: 'Повтор', exact: true }).click();
  await action(page, '1', 'Очистить посещения');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(apartment(page, '1')).toHaveAccessibleName('Квартира 1, Повтор');
  await action(page, '1', 'Очистить посещения');
  await page.getByRole('button', { name: 'Очистить', exact: true }).click();
  await expect(apartment(page, '1')).toHaveAccessibleName('Квартира 1, Не посещена');
  await openArchive(page);
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(apartment(page, '1')).toHaveAccessibleName('Квартира 1, Повтор');
  await action(page, '1', 'Удалить квартиру');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(apartment(page, '1')).toBeVisible();
  await action(page, '1', 'Удалить квартиру');
  await page.getByRole('button', { name: 'В архив', exact: true }).click();
  await expect(apartment(page, '1')).toHaveCount(0);
  await openArchive(page);
  await page.screenshot({ path: 'artifacts/new-archive.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(apartment(page, '1')).toBeVisible();
  await page.getByRole('button', { name: 'Все участки', exact: true }).click();
  await page.getByRole('button', { name: 'Меню участка Тестовый участок', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить участок', exact: true }).click();
  await page.getByRole('button', { name: 'В архив', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Открыть участок Тестовый участок', exact: true }),
  ).toHaveCount(0);
  await openArchive(page);
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Открыть участок Тестовый участок', exact: true }),
  ).toBeVisible();
});
test('backup carries archive and details and rejects corrupted imports', async ({ page }) => {
  const data = createDemo(),
    t = data.territories[0],
    e = t.entrances[0];
  e.apartments[0].details.phone = '12345';
  const archived = archiveEntity(data, 'apartment', t.id, e.id, e.apartments[1].id);
  await page.addInitScript(
    (value) => localStorage.setItem('uchastki:data:v1', value),
    serializeBackup(archived),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки и резервная копия', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Сохранить копию в файл', exact: true }).click(),
  ]);
  const backup = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(backup).archive).toHaveLength(1);
  expect(JSON.parse(backup).territories[0].entrances[0].apartments[0].details.phone).toBe('12345');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Восстановить из файла', exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(page.getByText('Копия не загружена', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Понятно', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Открыть участок Пример участка', exact: true }),
  ).toBeVisible();
});
test('sharing opens QR code and separate Android and iPhone installation instructions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(page.getByText('Журнал обхода', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Поделиться приложением с другими', exact: true }).click();
  await expect(page.getByLabel('QR-код страницы скачивания для Android и iPhone')).toBeVisible();
  await page.getByRole('button', { name: 'Инструкция для iPhone', exact: true }).click();
  await expect(page.getByText(/Для бесплатной установки нужен компьютер/)).toBeVisible();
  await page.screenshot({ path: 'artifacts/new-share-iphone.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Инструкция для Android', exact: true }).click();
  await expect(page.getByText(/Откройте страницу скачивания и выберите APK/)).toBeVisible();
});
