/** Local, user-initiated viewport capture. Never uploads or persists the image. */
export async function captureSupportScreen(): Promise<File> {
  const { default: html2canvas } = await import('html2canvas');
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  // Bound raster memory independently of Retina/device pixel ratio.
  const scale = Math.min(1, 1600 / Math.max(width, height));
  const canvas = await html2canvas(document.body, {
    width, height, x: window.scrollX, y: window.scrollY, scale,
    windowWidth: width, windowHeight: height,
    logging: false, useCORS: false, allowTaint: false, imageTimeout: 1500,
    backgroundColor: '#FAFAF8',
    ignoreElements: element => Boolean(element.closest('[data-support-ui], [data-support-private]'))
      || ['IFRAME', 'VIDEO'].includes(element.tagName),
    onclone: document => {
      document.querySelectorAll<HTMLInputElement>('input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"]')
        .forEach(input => { input.value = ''; input.removeAttribute('value'); input.style.visibility = 'hidden'; });
    },
  });
  try {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('No se pudo crear la captura.')), 'image/jpeg', 0.8));
    if (blob.size > 5 * 1024 * 1024) throw new Error('La captura supera el tamaño permitido.');
    return new File([blob], `sitrep-pantalla-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally { canvas.width = 0; canvas.height = 0; }
}
