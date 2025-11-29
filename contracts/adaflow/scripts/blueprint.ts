/**
 * AdaFlow Contract Blueprint Parser
 * Loads and parses the compiled Aiken contracts from plutus.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the plutus.json blueprint
const blueprintPath = path.join(__dirname, '..', 'plutus.json');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

export interface Validator {
  title: string;
  compiledCode: string;
  hash: string;
  datum?: { title: string; schema: any };
  redeemer?: { title: string; schema: any };
  parameters?: Array<{ title: string; schema: any }>;
}

export interface Blueprint {
  preamble: {
    title: string;
    description: string;
    version: string;
    plutusVersion: string;
  };
  validators: Validator[];
  definitions: Record<string, any>;
}

export const getBlueprint = (): Blueprint => blueprint;

export const getCustodialWalletValidator = (): Validator => {
  const validator = blueprint.validators.find(
    (v: Validator) => v.title === 'custodial_wallet.custodial_wallet.spend'
  );
  if (!validator) throw new Error('Custodial wallet validator not found');
  return validator;
};

export const getAuthorizationNftValidator = (): Validator => {
  const validator = blueprint.validators.find(
    (v: Validator) => v.title === 'authorization_nft.authorization_nft.mint'
  );
  if (!validator) throw new Error('Authorization NFT validator not found');
  return validator;
};

// Helper to get script hash (address) for the custodial wallet
export const getCustodialWalletScriptHash = (): string => {
  return getCustodialWalletValidator().hash;
};

// Helper to get the compiled CBOR code
export const getCustodialWalletScript = (): string => {
  return getCustodialWalletValidator().compiledCode;
};

export const getAuthorizationNftScript = (): string => {
  return getAuthorizationNftValidator().compiledCode;
};

console.log('📜 Blueprint loaded successfully');
console.log(`   - Title: ${blueprint.preamble.title}`);
console.log(`   - Plutus Version: ${blueprint.preamble.plutusVersion}`);
console.log(`   - Validators: ${blueprint.validators.length}`);
