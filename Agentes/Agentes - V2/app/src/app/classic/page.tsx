import {Application} from '@/ui/Application';
export default function Page(){return <Application demo={process.env.AUTH_MODE!=='msal'}/>}
