"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function EnglishMigration() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const convert = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/english-migration', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Conversion failed');
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">Convert saved content to English</h1>
      <p>Update generated course content and concept explanations. Your personal notes, graph layout, and connections stay unchanged.</p>
      <Button disabled={busy} onClick={convert}>{busy ? 'Converting...' : 'Convert to English'}</Button>
      <pre className="whitespace-pre-wrap" role="status">{result}</pre>
    </main>
  );
}
