import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppContext,initialState} from '../src/studio/ui/state';
import {Chat} from '../src/studio/ui/workspace';
test('Piloto: prévia de cenário identifica a fonte sintética e conserva o recorte',()=>{
 const value:any={s:{...initialState,period:'range',company:'Filial Sul',dateFrom:'2025-09-01',dateTo:'2025-09-30'},server:{credits:{available:1250,allocated:1250,cost:5},runtime:{dataProvider:'financial-test',aiProvider:'bedrock'}},proposal:{kind:'scenario',title:'Redução',description:'Confira',patch:{scenarioCenter:'Pesquisa',percent:5,screen:'scenarios'}},data:{count:6,lineage:{provider:"financial-test"}},busy:0,canUndo:false};
 const html=renderToStaticMarkup(React.createElement(AppContext.Provider,{value},React.createElement(Chat)));
 assert.ok(html.includes('2025-09-01 a 2025-09-30'));assert.ok(html.includes('Filial Sul'));assert.ok(html.includes('Pesquisa'));assert.ok(!html.includes('>SAP<'));assert.ok(html.includes('Serviço financeiro de teste'));
});
