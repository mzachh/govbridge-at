'use client';
import { useEffect } from 'react';
export function LanguageMarker({ lang }: { lang: 'en' | 'de' }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
