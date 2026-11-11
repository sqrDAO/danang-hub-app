// Intl locale for the app language: Vietnamese → 'vi-VN', anything else → 'en-US'.
export const appLocale = (language) => (language?.startsWith('vi') ? 'vi-VN' : 'en-US')
