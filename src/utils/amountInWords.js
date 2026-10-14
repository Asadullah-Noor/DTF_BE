const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n) {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'Hundred'); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) out.push(ONES[n]);
  return out.join(' ');
}

// paisa (integer) -> "Rupees ... Only"
export function amountInWords(paisa) {
  const total = Math.max(0, Math.round(paisa || 0));
  const rupees = Math.floor(total / 100);
  const ps = total % 100;
  if (rupees === 0 && ps === 0) return 'Zero Rupees Only';

  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;
  if (crore) parts.push(below1000(crore), 'Crore');
  if (lakh) parts.push(below1000(lakh), 'Lakh');
  if (thousand) parts.push(below1000(thousand), 'Thousand');
  if (rest) parts.push(below1000(rest));

  let text = 'Rupees ' + (parts.join(' ') || 'Zero');
  if (ps) text += ` and ${below1000(ps)} Paisa`;
  return text + ' Only';
}