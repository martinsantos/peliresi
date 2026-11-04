import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['manual.spec.ts','manual-training.spec.ts','manual-four-phones.spec.ts']});
