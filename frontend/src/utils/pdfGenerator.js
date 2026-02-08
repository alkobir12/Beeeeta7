import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Downloads a DOM element as a high-quality A4 PDF.
 * Ensures Light Mode (black text on white bg) for readability.
 */
export const downloadPDF = async (element, fileName = 'document.pdf', options = {}) => {
  if (!element) return;

  // 1. Force light mode styles on the cloned element
  // We clone the element so we don't mess up the actual UI if it's visible (though usually it's hidden)
  // Actually, html2canvas reads the element as is.
  // We should apply a class or style to the element BEFORE capturing.
  // Since 'element' is usually a temp div we created, we can modify it freely.
  
  element.style.color = '#000000';
  element.style.backgroundColor = '#ffffff';
  
  // Force all children to have dark text if they have light text classes
  // This is a brute-force way to ensure contrast.
  const allElements = element.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    const style = window.getComputedStyle(el);
    if (style.color === 'rgb(255, 255, 255)' || style.color === 'rgb(248, 250, 252)') { // slate-50/white
       el.style.color = '#000000';
    }
    if (style.backgroundColor === 'rgb(15, 23, 42)') { // slate-900
       el.style.backgroundColor = '#ffffff';
    }
  }

  const scale = options.scale || 2; 
  const format = options.format || 'a4';

  try {
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff', // Final canvas bg
      windowWidth: 794, // Force A4 width context
    });

    const pdf = new jsPDF('p', 'mm', format);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(fileName);
    return true;

  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
};
