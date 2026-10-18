import {documentSchema,type DashboardDocument} from '../contracts';

export function hasDocumentChanges(current:object,saved?:object){
 if(!saved)return true;
 const a=current as Record<string,unknown>,b=saved as Record<string,unknown>;
 return Object.keys(documentSchema.shape).some(key=>JSON.stringify(a[key]??null)!==JSON.stringify(b[key]??null));
}

export type SuggestionCatalog={periods:string[];centers:string[]};
export function analysisSuggestions(catalog:SuggestionCatalog|null){
 if(!catalog?.periods.length)return [];
 const year=[...catalog.periods].sort().at(-1)!.slice(0,4);
 return [`Compare realizado e orçamento em ${year}`,'Mostre os centros acima do orçamento',...(catalog.centers[0]?[`Detalhe os valores de ${catalog.centers[0]}`]:[])];
}
