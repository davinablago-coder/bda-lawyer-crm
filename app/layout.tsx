import type { Metadata } from 'next';
export const metadata: Metadata = {title:'BDA Lawyer — CRM',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body>{children}</body></html>;
}
