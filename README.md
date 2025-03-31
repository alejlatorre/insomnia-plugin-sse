# Insomnia Plugin SSE

This plugin enables Server-Sent Events (SSE) connections in Insomnia. It supports all HTTP methods (GET, POST, PUT, DELETE, etc.) by leveraging custom headers to trigger SSE behavior.

## Usage

To use this plugin:

- Create a request using your desired HTTP method.
- Add the header `x-sse` with a truthy value to activate the SSE connection.
- Optionally, specify the event name with the header `x-event-name` (defaults to "message").

## Examples

### Using SSE

1. Create a request (GET, POST, PUT, etc.).
2. Include the header `x-sse: true`.
3. Optionally, include `x-event-name: <event>` to filter events.
4. Send the request. The plugin manages the SSE connection automatically.

## Features

- Supports all HTTP methods.
- Custom header configuration for SSE activation and event filtering.
- Request body support for non-GET methods.

## In progress

- The target is to provide a custom event message formatter based on message type(s) that will be printed in a container for debugging purposes
- It will be added in the SSE request type

## Acknowledgements

This plugin is inspired by [insomnia-plugin-skugga-sse](https://github.com/BinarSkugga/insomnia-plugin-skugga-sse) but since I have reestructured the code and added lot of changes with other patterns, I decided to create a new one.
