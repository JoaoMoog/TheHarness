import {NextResponse} from 'next/server';
import {sapOpenApi} from '@/sap/openapi';
export function GET(){return NextResponse.json(sapOpenApi);}
