import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'Mimiz | Food, made easy', description: 'Order from your neighbourhood kitchen.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
