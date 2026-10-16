import {z} from 'zod';

export const idSchema=z.string().min(1).max(150);
export const nameSchema=z.string().trim().min(1).max(120);
export const chartSchema=z.enum(['column','bar','line','donut','waterfall','table','indicator','text']);
export const filtersSchema=z.object({center:z.string().max(100).default('all'),period:z.enum(['all','q3']).default('all'),company:z.string().max(100).default('all')}).strict();
export const documentSchema=filtersSchema.extend({schemaVersion:z.literal(1).default(1),sourceId:z.literal('finance').default('finance'),title:nameSchema,chart:chartSchema.default('column'),chartTitle:nameSchema.default('Realizado x orçamento'),highlight:z.boolean().default(false),showMetric:z.boolean().default(true),showChart:z.boolean().default(true),duplicate:z.boolean().default(false),reversed:z.boolean().default(false)}).strict();
export const initialDocument=documentSchema.parse({title:'Desempenho financeiro'});
export type DashboardDocument=z.infer<typeof documentSchema>;
export type Filters=z.infer<typeof filtersSchema>;
export const formulaSchema=z.enum(['budget-actual','actual-budget','actual/budget']);
const amount=z.number().finite().min(0).max(1e12);
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('dashboard.save'),id:idSchema.optional(),document:documentSchema}).strict(),
 z.object({type:z.literal('dashboard.duplicate'),id:idSchema}).strict(),
 z.object({type:z.literal('dashboard.delete'),id:idSchema}).strict(),
 z.object({type:z.literal('dashboard.favorite'),id:idSchema,favorite:z.boolean()}).strict(),
 z.object({type:z.literal('dashboard.restore'),id:idSchema,versionId:idSchema}).strict(),
 z.object({type:z.literal('comment.add'),boardId:idSchema,text:z.string().trim().min(1).max(2000)}).strict(),
 z.object({type:z.literal('plan.save'),name:nameSchema,budgets:z.array(amount).length(4)}).strict(),
 z.object({type:z.literal('plan.delete'),id:idSchema}).strict(),
 z.object({type:z.literal('scenario.save'),name:nameSchema,percent:z.number().finite().min(0).max(100)}).strict(),
 z.object({type:z.literal('scenario.delete'),id:idSchema}).strict(),
 z.object({type:z.literal('model.save'),name:nameSchema,formula:formulaSchema}).strict(),
 z.object({type:z.literal('source.toggle'),paused:z.boolean()}).strict(),
]);
export const mutationSchema=z.object({revision:z.number().int().positive(),operationId:z.string().uuid(),command:commandSchema}).strict();
export type StudioCommand=z.input<typeof commandSchema>;
export const querySchema=filtersSchema.extend({search:z.string().max(120).default(''),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(200).default(100)}).strict();
export const assistantInputSchema=z.object({prompt:z.string().trim().min(1).max(4000),document:documentSchema,percent:z.number().min(0).max(100).default(5)}).strict();
// Partial edits must never inherit document defaults: omitted means preserve.
export const patchSchema=z.object({
 schemaVersion:z.literal(1),sourceId:z.literal('finance'),title:nameSchema,
 center:z.string().max(100),period:z.enum(['all','q3']),company:z.string().max(100),
 chart:chartSchema,chartTitle:nameSchema,highlight:z.boolean(),showMetric:z.boolean(),
 showChart:z.boolean(),duplicate:z.boolean(),reversed:z.boolean(),
 percent:z.number().min(0).max(100),screen:z.enum(['dashboard','scenarios']),
}).partial().strict();
export const proposalSchema=z.object({kind:z.enum(['create','filter','chart','highlight','metric','scenario','forecast']),title:nameSchema,description:z.string().min(1).max(1000),patch:patchSchema}).strict();
export const assistantOutputSchema=z.object({status:z.enum(['ready','clarify']),message:z.string().min(1).max(2000),proposal:proposalSchema.nullable()}).strict().refine(v=>(v.status==='ready')===!!v.proposal,'Status e proposta incompatíveis');
export type Proposal=z.infer<typeof proposalSchema>;
export type StudioMessage={role:'user'|'assistant';text:string};
export type Board={id:string;document:DashboardDocument;favorite:boolean;revision:number;updatedAt:string;versions:{id:string;at:string;document:DashboardDocument}[]};
export type PlanVersion={id:string;name:string;budgets:number[];total:number;baseRevision:string;createdAt:string;createdBy:string};
export type Scenario={id:string;name:string;percent:number;saving:number;actual:number;balance:number;baseRevision:string;createdAt:string;createdBy:string};
export type Comment={id:string;boardId:string;authorId:string;author:string;text:string;at:string};
export type StudioState={id:string;owner:string;schemaVersion:1;revision:number;boards:Board[];plans:PlanVersion[];scenarios:Scenario[];measure:{name:string;formula:z.infer<typeof formulaSchema>};comments:Comment[];sourcePaused:boolean;updatedAt:string};
export type FinancialRow={id:string;center:string;company:string;date:string;month:string;index:number;actual:number;budget:number};
export type FinancialGroup={name:string;code:string;owner:string;actual:number;budget:number};
export type DataSnapshot={rows:FinancialRow[];revision:string;provider:'demo'|'sap';updatedAt:string};
export type QueryResult={actual:number;budget:number;balance:number;execution:number|null;groups:FinancialGroup[];months:{month:string;index:number;actual:number;budget:number}[];rows:FinancialRow[];count:number;matchedCount:number;offset:number;limit:number;lineage:{sourceId:string;revision:string;provider:string;updatedAt:string;unit:'BRL';filters:Filters}};
/** Providers operate on authorized scope, never on a URL or credential supplied by the browser. */
export interface DataProvider {read(signal?:AbortSignal):Promise<DataSnapshot>}
export interface AnalysisPlanner {propose(input:z.infer<typeof assistantInputSchema>,data:QueryResult,signal?:AbortSignal):Promise<z.infer<typeof assistantOutputSchema>>}
/** A persistent implementation must provide atomic compare-and-swap and idempotency across replicas. */
export interface StudioRepository {get(workspaceId:string):StudioState;mutate(workspaceId:string,actorId:string,request:z.infer<typeof mutationSchema>,change:(current:StudioState)=>StudioState):{state:StudioState;targetId?:string}}
