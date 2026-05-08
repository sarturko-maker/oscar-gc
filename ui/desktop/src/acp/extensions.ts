import type { ExtensionResponse, ExtensionEntry } from '../api';
import { getExtensions as apiGetExtensions } from '../api';
import { featureFlags } from '../featureFlags';
import { getAcpClient } from './acpConnection';

type GetExtensionsResult = Awaited<ReturnType<typeof apiGetExtensions>>;

async function getExtensionsViaAcp(): Promise<ExtensionResponse> {
  const client = await getAcpClient();
  const response = await client.goose.GooseConfigExtensions({});
  return {
    extensions: response.extensions as ExtensionEntry[],
    warnings: response.warnings,
  };
}

export async function getConfiguredExtensions(): Promise<GetExtensionsResult> {
  if (!featureFlags.acpConfigExtensions) {
    return apiGetExtensions();
  }

  try {
    const data = await getExtensionsViaAcp();
    return {
      data,
      error: undefined,
      response: new window.Response(null, { status: 200 }),
      request: new window.Request('https://goose-acp.local/config/extensions'),
    } as GetExtensionsResult;
  } catch (error) {
    console.warn('ACP config extensions read failed; falling back to REST', error);
    return apiGetExtensions();
  }
}
