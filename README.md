# Insomnia Plugin SSE

This plugin allows you to make SSE (Server-Sent Events) requests directly in Insomnia, including support for POST, PUT, and other HTTP methods.

## Usage

There are two ways to use this plugin:

1. Create a request with the custom HTTP method `SSE` (this will use GET)
2. Use any HTTP method (GET, POST, PUT, etc.) and add the header `x-sse` with a truthy value

You can specify the event name in the `x-event-name` header. If not specified, it will listen to "message" events.

**Note that the Insomnia plugin API doesn't allow us to disable the initial request. You will receive a dummy request followed by the SSE connection.**

## Examples

### Using SSE with GET

Create a GET request, add the `x-sse` header, and send the request.

### Using SSE with POST or other methods

Simply set your request method to POST, add the body content as usual, and add the `x-sse` header.

## Features

- Support for all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Custom headers support
- Request body support for non-GET methods
- Event filtering via `x-event-name` header

## Acknowledgements

This idea was originally implemented in [insomnia-plugin-skugga-sse](https://github.com/BinarSkugga/insomnia-plugin-skugga-sse) but since I have implemented a lot of changes with other patterns, I decided to create a new plugin.
