import test from 'node:test';
import assert from 'node:assert/strict';
import {initialDocument} from '../src/studio/contracts';
import {hasDocumentChanges,analysisSuggestions} from '../src/studio/ui/analysisPresentation';

test('saved state compares document content, normalizes legacy defaults and ignores UI state',()=>{
 assert.equal(hasDocumentChanges({...initialDocument,draft:'not sent'} as any,initialDocument),false);
 assert.equal(hasDocumentChanges({...initialDocument,dateFrom:null,dateTo:null},initialDocument),false);
 assert.equal(hasDocumentChanges({...initialDocument,center:'Pesquisa'},initialDocument),true);
 assert.equal(hasDocumentChanges(initialDocument,undefined),true);
 assert.equal(hasDocumentChanges({...initialDocument,chart:'bar'},initialDocument),true);
});

test('suggestions use only the selected source catalogue, without invented dates or centers',()=>{
 const suggestions=analysisSuggestions({periods:['2024-02','2024-11'],centers:['Pesquisa']});
 assert.ok(suggestions.some(s=>s.includes('2024')));
 assert.ok(suggestions.some(s=>s.includes('Pesquisa')));
 assert.ok(suggestions.every(s=>!s.includes('2026')&&!s.includes('Tecnologia')));
 assert.deepEqual(analysisSuggestions(null),[]);
 assert.deepEqual(analysisSuggestions({periods:[],centers:[]}),[]);
});
