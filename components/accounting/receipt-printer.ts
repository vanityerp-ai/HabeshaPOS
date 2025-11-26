"use client"

import { Transaction } from "@/lib/transaction-types"
import { SettingsStorage } from "@/lib/settings-storage"

/**
 * Print a bilingual (English/Arabic) receipt for a transaction
 */
export function printReceipt(transaction: Transaction, getLocationName?: (id: string) => string): void {
  // Get branding name from settings
  const settings = SettingsStorage.getGeneralSettings();
  const companyName = settings.branding?.companyName || settings.businessName || "Vanity Hub";
  // Helper for Arabic numerals
  function toArabicNumber(num: number | string) {
    return String(num).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  }

  // Simple English to Arabic phonetic transliteration (fallback)
  function toPhoneticArabic(text: string): string {
    // This is a basic mapping for demonstration. For production, use a proper transliteration library.
    const map: Record<string, string> = {
      'a': 'ا', 'b': 'ب', 'c': 'ك', 'd': 'د', 'e': 'ي', 'f': 'ف', 'g': 'ج', 'h': 'ه', 'i': 'ي', 'j': 'ج', 'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'o': 'و', 'p': 'ب', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت', 'u': 'و', 'v': 'ف', 'w': 'و', 'x': 'كس', 'y': 'ي', 'z': 'ز', 'A': 'ا', 'B': 'ب', 'C': 'ك', 'D': 'د', 'E': 'ي', 'F': 'ف', 'G': 'ج', 'H': 'ه', 'I': 'ي', 'J': 'ج', 'K': 'ك', 'L': 'ل', 'M': 'م', 'N': 'ن', 'O': 'و', 'P': 'ب', 'Q': 'ق', 'R': 'ر', 'S': 'س', 'T': 'ت', 'U': 'و', 'V': 'ف', 'W': 'و', 'X': 'كس', 'Y': 'ي', 'Z': 'ز', ' ': ' ', '-': '-', '_': '_', '.': '.', ',': ',', '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
    };
    return text.split('').map(char => map[char] || char).join('');
  }

  // Format items if available
  let itemsHtml = '';
  if (transaction.items && transaction.items.length > 0) {
    // Use transaction-level discount percentage for consistency
    const transactionDiscountPercentage = transaction.discountPercentage || 0;
    
    itemsHtml = transaction.items.map(function (item) {
      // Show discount only for items that have discount applied (services)
      const itemDiscount = item.discountApplied && item.type === 'service' ? transactionDiscountPercentage : 0;
      
      return `
        <div style="display: flex; font-size: 12px; border-bottom: 1px dashed #aaa;">
          <div style="flex: 2;">${item.name}</div>
          <div style="flex: 1;">${item.type}</div>
          <div style="flex: 1; text-align: right;">QAR ${item.originalPrice ?? '-'}</div>
          <div style="flex: 1; text-align: right;">${itemDiscount > 0 ? itemDiscount + '%' : '-'}</div>
          <div style="flex: 1; text-align: right;">QAR ${item.totalPrice}</div>
        </div>
        <div style="display: flex; font-size: 11px; direction: rtl; border-bottom: 1px dashed #aaa;">
          <div style="flex: 2;">${toPhoneticArabic(item.name)}</div>
          <div style="flex: 1;">${toPhoneticArabic(item.type)}</div>
          <div style="flex: 1; text-align: left;">${item.originalPrice ? toArabicNumber(item.originalPrice) + ' ر.ق' : '-'}</div>
          <div style="flex: 1; text-align: left;">${itemDiscount > 0 ? toArabicNumber(itemDiscount) + '٪' : '-'}</div>
          <div style="flex: 1; text-align: left;">${item.totalPrice ? toArabicNumber(item.totalPrice) + ' ر.ق' : '-'}</div>
        </div>
      `;
    }).join('');
  }

  const date = typeof transaction.date === 'string'
    ? new Date(transaction.date)
    : transaction.date;
  const formattedDate = date.toLocaleString();

  const locationName = getLocationName ? getLocationName(transaction.location) : transaction.location;

  const receiptHtml = `
    <html>
      <head>
        <title>${companyName} - ${transaction.id}</title>
        <style>
          body { width: 300px; font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 8px; }
          .title { font-weight: bold; font-size: 16px; }
          .subtitle { font-weight: bold; font-size: 14px; }
          .subtitle-ar { font-weight: bold; font-size: 14px; direction: rtl; }
          .info, .summary { margin-bottom: 8px; }
          .label { font-weight: bold; }
          .label-ar { font-weight: bold; direction: rtl; font-size: 11px; }
          .total { font-weight: bold; font-size: 14px; }
          .discount { color: #15803d; font-weight: bold; }
          .thankyou { text-align: center; margin-top: 10px; font-size: 12px; }
          .thankyou-ar { text-align: center; direction: rtl; font-size: 11px; }
          hr { margin: 8px 0; border: none; border-top: 1px solid #000; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${companyName}</div>
        </div>
        <div class="info">
          <div><span class="label">Transaction ID:</span> ${transaction.id}</div>
          <div class="label-ar">معرّف المعاملة: ${transaction.id}</div>
          <div><span class="label">Date:</span> ${formattedDate}</div>
          <div class="label-ar">التاريخ: ${toArabicNumber(formattedDate)}</div>
          <div><span class="label">Client:</span> ${transaction.clientName || '-'}</div>
          <div class="label-ar">العميل: ${transaction.clientName ? toPhoneticArabic(transaction.clientName) : '-'}</div>
          <div><span class="label">Staff:</span> ${transaction.staffName || '-'}</div>
          <div class="label-ar">الموظف: ${transaction.staffName ? toPhoneticArabic(transaction.staffName) : '-'}</div>
          <div><span class="label">Location:</span> ${locationName}</div>
          <div class="label-ar">الموقع: ${locationName}</div>
        </div>
        <hr/>
        <div style="display: flex; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px;">
          <div style="flex: 2;">Item</div>
          <div style="flex: 1;">Type</div>
          <div style="flex: 1; text-align: right;">Price</div>
          <div style="flex: 1; text-align: right;">Discount</div>
          <div style="flex: 1; text-align: right;">Total</div>
        </div>
        <div style="display: flex; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; direction: rtl; font-size: 11px;">
          <div style="flex: 2;">الصنف</div>
          <div style="flex: 1;">النوع</div>
          <div style="flex: 1; text-align: left;">السعر</div>
          <div style="flex: 1; text-align: left;">الخصم</div>
          <div style="flex: 1; text-align: left;">الإجمالي</div>
        </div>
        ${itemsHtml}
        <hr/>
        <div class="summary">
          <div><span class="label">Payment Method:</span> ${transaction.paymentMethod || '-'}</div>
          <div class="label-ar">طريقة الدفع: ${transaction.paymentMethod || '-'}</div>
          <div><span class="label">Status:</span> ${transaction.status || '-'}</div>
          <div class="label-ar">الحالة: ${transaction.status || '-'}</div>
          <div><span class="label">Original Total:</span> ${transaction.originalServiceAmount ? '<s>QAR ' + transaction.originalServiceAmount + '</s>' : '-'}</div>
          <div class="label-ar">الإجمالي الأصلي: ${transaction.originalServiceAmount ? '<s>' + toArabicNumber(transaction.originalServiceAmount) + ' ر.ق</s>' : '-'}</div>
          <div><span class="label">Discount:</span> ${transaction.discountAmount ? '<span class="discount">QAR ' + transaction.discountAmount + (transaction.discountPercentage ? ' (' + transaction.discountPercentage + '%)' : '') + '</span>' : '-'}</div>
          <div class="label-ar">الخصم: ${transaction.discountAmount ? '<span class="discount">' + toArabicNumber(transaction.discountAmount) + ' ر.ق' + (transaction.discountPercentage ? ' (' + toArabicNumber(transaction.discountPercentage) + '٪)' : '') + '</span>' : '-'}</div>
          <div class="total"><span class="label">Final Amount Paid:</span> QAR ${transaction.amount}</div>
          <div class="total label-ar">المبلغ النهائي المدفوع: ${toArabicNumber(transaction.amount)} ر.ق</div>
        </div>
        <div class="thankyou">Thank you for your business!</div>
        <div class="thankyou-ar">شكراً لتعاملكم معنا!</div>
      </body>
    </html>
  `;

  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }
}

