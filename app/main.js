const net = require('net')
const fs = require('fs')
const process = require('process')
const zlib = require('zlib')

let fileStorage = process.argv.length > 3 ? process.argv[3] : './files/'

console.log('Logs from your program will appear here!')

function parseRequestHeaders(httpHeadersAndRequestBody) {
	const headers = {}
	for (const header of httpHeadersAndRequestBody) {
		const [key, value] = header?.trim().split(': ')
		if (key && value) {
			headers[key.toLowerCase()] = value.toLowerCase()
		}
	}
	return headers
}

function createResponse({ verb, resource, headers, body }) {
	switch (verb.trim().toLowerCase()) {
		case 'get':
			return handleGetRequest(resource, headers)
		case 'post':
			return handlePostRequest(resource, body)
		default:
			return 'HTTP/1.1 405 Method Not Allowed\r\n\r\n'
	}
}

function handleGetRequest(resource, headers) {
	if (resource === '/') {
		return 'HTTP/1.1 200 OK\r\n\r\n'
	} else if (resource.toLowerCase() === '/user-agent') {
		const userAgent = headers['user-agent'] || ''
		return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`
	} else if (resource.startsWith('/echo')) {
		const str = resource.split('/')[2] || ''
		return createEchoResponse(str, headers)
	} else if (resource.startsWith('/files')) {
		return handleFileGetRequest(resource.split('/')[2])
	} else {
		return 'HTTP/1.1 404 Not Found\r\n\r\n'
	}
}

function createEchoResponse(str, headers) {
	if (headers['accept-encoding']?.includes('gzip')) {
		const gzippedResponse = zlib.gzipSync(str)
		const responseHeaders = `Content-Encoding: gzip\r\nContent-Type: text/plain\r\nContent-Length: ${gzippedResponse.length}\r\n`
		return Buffer.concat([
			Buffer.from(`HTTP/1.1 200 OK\r\n${responseHeaders}\r\n`),
			gzippedResponse,
		])
	} else {
		const responseHeaders = `Content-Type: text/plain\r\nContent-Length: ${str.length}\r\n`
		return Buffer.from(`HTTP/1.1 200 OK\r\n${responseHeaders}\r\n${str}`)
	}
}

function handleFileGetRequest(fileName) {
	if (!fileName) return 'HTTP/1.1 404 Not Found\r\n\r\n'
	const filePath = `${fileStorage}${fileName}`
	if (!fs.existsSync(filePath)) {
		return 'HTTP/1.1 404 Not Found\r\n\r\n'
	}
	const file = fs.readFileSync(filePath)
	const responseHeaders = `Content-Type: application/octet-stream\r\nContent-Length: ${file.length}\r\n`
	return Buffer.concat([
		Buffer.from(`HTTP/1.1 200 OK\r\n${responseHeaders}\r\n`),
		file,
	])
}

function handlePostRequest(resource, body) {
	if (resource.startsWith('/files')) {
		const fileName = resource.split('/')[2]
		if (fileName) {
			const filePath = `${fileStorage}${fileName}`
			fs.writeFileSync(filePath, body)
			return 'HTTP/1.1 201 Created\r\n\r\n'
		}
	}
	return 'HTTP/1.1 400 Bad Request\r\n\r\n'
}

function sendResponse(socket, response) {
	socket.write(response)
	socket.end()
}

const server = net.createServer({ keepAlive: true }, (socket) => {
	socket.on('data', (data) => {
		const request = data.toString()
		const [httpStartLine, ...httpHeadersAndRequestBody] = request.split('\r\n')
		const headers = parseRequestHeaders(httpHeadersAndRequestBody)
		const [verb, resource] = httpStartLine.split(' ')
		const body = httpHeadersAndRequestBody.slice(-1)[0]
		const response = createResponse({ verb, resource, headers, body })
		sendResponse(socket, response)
	})

	socket.on('end', () => {
		console.log('Connection closed')
	})

	socket.on('error', (err) => {
		console.error(err)
	})
})

server.listen(4221, 'localhost')
