import type { Provider } from './types';
import { pingOpenAICompatible } from './openaiCompat';

export const openai: Provider = {
	id: 'openai',
	label: 'OpenAI',
	defaultModel: 'gpt-4o-mini',
	keysUrl: 'https://platform.openai.com/api-keys',
	ping: (opts) => pingOpenAICompatible('https://api.openai.com/v1', opts)
};
