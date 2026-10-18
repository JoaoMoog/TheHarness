const fs = require('node:fs');
const path = require('node:path');
const folder = __dirname;
const verificationPath = path.join(folder, 'verification-taste.json');
const verification = JSON.parse(fs.readFileSync(verificationPath, 'utf8'));
verification.visualReview = {
  screens: ['dashboard', 'editor', 'library', 'libraryList', 'home', 'aiWorkbench', 'mobileDashboard'],
  previews: ['dashboard-taste.png', 'editor-taste.png', 'library-taste-final.png', 'library-list-taste-final.png', 'home-taste-final.png', 'ai-taste-final.png', 'mobile-taste-final.png'],
  status: 'Conferidos: hierarquia, espaçamento, legibilidade e navegação superior.'
};
fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2) + '\n');
const statePath = path.join(folder, 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.validation = verification.validation;
state.revision = verification.validation.revision;
fs.writeFileSync(statePath, JSON.stringify(state));
console.log(JSON.stringify({revision: state.revision, screens: state.validation.screens, layoutIssueCount: state.validation.layoutIssueCount, allFlowsConnected: state.validation.allFlowsConnected}));
