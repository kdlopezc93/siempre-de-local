/**
 * CSV para Excel y Google Sheets: BOM (para que Excel lea UTF-8), todo entre comillas,
 * comillas duplicadas y saltos CRLF. Las celdas que empiezan con `= + - @` (o tab / CR) se
 * prefijan con `'`: así un nombre como `=HYPERLINK(...)` no se ejecuta como fórmula.
 */
/** Marca de orden de bytes: así Excel abre el CSV como UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return `${BOM}${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}
