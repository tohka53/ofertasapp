/** Formato "Q 1,234.50". */
export function formatMoney(amount: number, symbol: string): string {
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  const [int = '0', dec = '00'] = fixed.split('.');
  const withThousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol} ${withThousands}.${dec}`;
}
