import { html, raw } from 'hono/html'
import type { ApiReferenceConfigurationWithMultipleSources } from '@scalar/types/api-reference'

import packageJSON from '#package.json' with { type: 'json' }

const getScalarConfig = (baseUrl: string) =>
	({
		slug: packageJSON.name,
		hideModels: true,
		hideClientButton: true,
		title: packageJSON.name,
		url: '/schema/openapi.json',
		showDeveloperTools: 'never',
		documentDownloadType: 'json',
		operationTitleSource: 'path',
		proxyUrl: 'https://proxy.scalar.com',
		favicon: 'https://explore.tempo.xyz/favicon.ico',
		sources: [{ url: '/schema/openapi.json', default: true }],
		authentication: {
			preferredSecurityScheme: 'apiKey',
			securitySchemes: {
				apiKeyHeader: {
					in: 'header',
					name: 'X-Tempo-API-Key',
					nameKey: 'X-Tempo-API-Key',
					type: 'apiKey',
					description: 'Tempo API Key',
				},
				apiKey: {
					in: 'query',
					name: 'key',
					nameKey: 'key',
					type: 'apiKey',
					description: 'Tempo API Key',
				},
			},
		},
		defaultHttpClient: {
			clientKey: 'curl',
			targetKey: 'shell',
		},
		servers: [
			{ url: baseUrl, description: 'Current' },
			{ url: 'https://api.tempo.xyz', description: 'Production' },
			{ url: 'https://api.porto.workers.dev', description: 'workers.dev' },
			{
				url: 'http://localhost:{port}',
				description: 'Local',
				variables: {
					port: { default: '6969', description: 'localhost port number' },
				},
			},
		],
		showSidebar: false,

		hiddenClients: {
			c: true,
			clojure: true,
			csharp: true,
			dart: true,
			fsharp: true,
			js: ['axios', 'jquery', 'xhr'],
			node: true,
			kotlin: true,
			objc: true,
			ocaml: true,
			r: true,
			swift: true,
		},
		layout: 'modern',
		telemetry: false,
		persistAuth: false,
	}) satisfies Partial<ApiReferenceConfigurationWithMultipleSources>

export const Docs = (props: { baseUrl: string }) => {
	const scalarConfig = getScalarConfig(props.baseUrl)
	return (
		<html lang="en">
			<head>
				<title>Tempo API</title>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</head>
			<body>
				{/** biome-ignore lint/correctness/useUniqueElementIds: _ */}
				<main id="app"></main>
				<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
				<script>{html /* jsx */`Scalar.createApiReference('#app', ${raw(JSON.stringify(scalarConfig))})`}</script>
			</body>
		</html>
	)
}
