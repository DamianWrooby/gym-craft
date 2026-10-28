// Marketing copy marks its accent phrases as [[phrase]], so translators move them with the words.
// Only trusted, compiled message strings pass through here; `<` is escaped all the same.
export const highlight = (text: string, className = 'text-secondary-400'): string =>
    text.replace(/</g, '&lt;').replace(/\[\[(.+?)\]\]/g, `<span class="${className}">$1</span>`);
