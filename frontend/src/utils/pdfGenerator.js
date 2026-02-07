import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Downloads a DOM element as a high-quality A4 PDF.
 * @param {HTMLElement} element - The DOM element to capture.
 * @param {string} fileName - The desired PDF file name (e.g., 'invoice_123.pdf').
 * @param {object} options - Optional settings { scale: number, format: 'a4' }.
 */
export const downloadPDF = async (element, fileName = 'document.pdf', options = {}) => {
  if (!element) {
    console.error('downloadPDF: Element not found');
    return;
  }

  const scale = options.scale || 2; // Higher scale for better quality
  const format = options.format || 'a4';

  try {
    // 1. Capture the element as a high-res canvas
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true, // For external images
      logging: false,
      backgroundColor: '#ffffff', // Ensure white background
      windowWidth: element.scrollWidth, // Capture full width
    });

    // 2. Create PDF
    // 'p' = portrait, 'mm' = millimeters, 'a4' = standard size
    const pdf = new jsPDF('p', 'mm', format);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // 3. Calculate dimensions to fit width
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 4. Convert canvas to image data
    const imgData = canvas.toDataURL('image/jpeg', 0.98); // High quality JPEG

    // 5. Add image to PDF (handle multi-page if necessary, but starting with single long page logic or scaling)
    // For strictly A4 documents, we often scale to fit or split. 
    // This implementation fits to width and allows height to flow (single page scaling) or splits if too long.
    
    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Add extra pages if content is longer than A4
    while (heightLeft > 0) {
      position = heightLeft - imgHeight; // Move the image up
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // 6. Save
    pdf.save(fileName);
    return true;

  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
};
