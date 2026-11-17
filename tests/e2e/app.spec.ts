import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('create a territory and entrance, change statuses and notes, persist and restore a backup', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Создать первый участок', exact: true }).click();
  await page.getByLabel('Название участка', { exact: true }).fill('Центральный');
  await page.getByLabel('Адрес или описание', { exact: true }).fill('Дом 12');
  await page.getByRole('button', { name: 'Создать участок', exact: true }).click();
  await page.getByRole('button', { name: 'Создать подъезд', exact: true }).click();
  await page.getByLabel('Количество этажей', { exact: true }).fill('2');
  await page.getByLabel('Квартир на этаже', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Создать подъезд и квартиры', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Квартира 6, Не посещена', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Отметить квартиру 1 пройденной', exact: true }).click();
  await page.getByRole('button', { name: 'Квартира 2: никого не застали', exact: true }).click();
  await page.getByRole('button', { name: 'Квартира 2, Никого не застали', exact: true }).click();
  await page
    .getByLabel('Дополнительные сведения', { exact: true })
    .fill('Зайти вечером после 18:00');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await page.getByLabel('Поиск квартиры или заметки').fill('вечером');
  await expect(
    page.getByRole('button', { name: 'Квартира 2, Никого не застали, есть заметка', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Квартира 1, Пройдена', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Очистить поиск', exact: true }).click();
  await page.screenshot({ path: 'artifacts/apartments-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Настройки и резервная копия', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Сохранить копию в файл', exact: true }).click(),
  ]);
  const path = await download.path();
  const backup = await readFile(path!, 'utf8');
  const parsed = JSON.parse(backup);
  expect(parsed.territories[0].entrances[0].apartments).toHaveLength(6);
  expect(parsed.territories[0].entrances[0].apartments[1].note).toContain('вечером');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.reload();
  // Expo Router restores the selected entrance from route parameters.
  await expect(
    page.getByRole('button', { name: 'Квартира 1, Пройдена', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Квартира 2, Никого не застали, есть заметка', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Пройдены · 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Квартира 1, Пройдена', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Квартира 2, Никого не застали, есть заметка', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Все · 6', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByLabel('Номер квартиры', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Добавить квартиру', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('уже есть');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  // A fresh isolated browser storage simulates a second phone.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Настройки и резервная копия', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Восстановить из файла', exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть участок Центральный', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть Подъезд 1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Квартира 2, Никого не застали, есть заметка', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('small phone layout, demo data and corrupted import protection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Создать первый участок', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/empty-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Открыть учебный пример', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки и резервная копия', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Восстановить из файла', exact: true }).click(),
  ]);
  await chooser.setFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByText('Копия не загружена', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Понятно', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Открыть участок Пример участка', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Открыть участок Пример участка', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть Подъезд 1', exact: true }).click();
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflowing).toBe(false);
  await page.screenshot({ path: 'artifacts/small-phone.png', fullPage: true });
});
