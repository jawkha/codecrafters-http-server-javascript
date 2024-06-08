const net = require('net')
const fs = require('fs')
const process = require('process')
const zlib = require('zlib')

let fileStorage = './files/'

if (process.argv.length > 3) {
	fileStorage = process.argv[3]
}

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log('Logs from your program will appear here!')

function parseRequestHeaders(httpHeadersAndRequestBody) {
	const headers = {}
	for (const header of httpHeadersAndRequestBody) {
		const [key, value] = header?.trim().split(':')
		headers[key?.toLowerCase()] = value?.toLowerCase()
	}
	console.log({ headers })
	return headers
}

function createResponse({ verb, resource, protocol, headers, body }) {
	if (verb.trim().toLowerCase() === 'get') {
		if (resource === '/') {
			return `HTTP/1.1 200 OK\r\n\r\n`
		} else if (resource.toLowerCase() === '/user-agent') {
			return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${headers['user-agent'].length}\r\n\r\n${headers['user-agent']}`
		} else if (resource.startsWith('/echo')) {
			const str = resource.split('/')[2]

			if (
				headers.hasOwnProperty('accept-encoding') &&
				// headers['accept-encoding'] === 'gzip') ||
				headers['accept-encoding']
					.split(',')
					.map((el) => el.trim())
					.includes('gzip')
			) {
				const gzippedResponse = zlib.gzipSync(str)
				// console.log({ gzippedResponse })
				const responseHeaders = `HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Type: text/plain\r\nContent-Length: ${gzippedResponse.length}\r\n`
				return `${responseHeaders}\r\n${gzippedResponse}`
			} else {
				const responseHeaders = `Content-Type: text/plain\r\nContent-Length: ${str.length}\r\n`
				return `HTTP/1.1 200 OK\r\n${responseHeaders}\r\n${str}`
			}
		} else if (resource.startsWith('/files')) {
			const fileName = resource.split('/')[2]
			if (fileName) {
				const fileExists = fs.existsSync(`${fileStorage}${fileName}`)
				if (!fileExists) {
					return `HTTP/1.1 404 Not Found\r\n\r\n`
				} else {
					const file = fs.readFileSync(`${fileStorage}${fileName}`)
					const headers = `Content-Type: application/octet-stream\r\nContent-Length: ${file.length}\r\n`
					return `HTTP/1.1 200 OK\r\n${headers}\r\n${file}`
				}
			}
		} else {
			return `HTTP/1.1 404 Not Found\r\n\r\n`
		}
	} else if (verb.trim().toLowerCase() === 'post') {
		if (resource.startsWith('/files')) {
			const fileName = resource.split('/')[2]
			if (fileName) {
				const file = fs.createWriteStream(`${fileStorage}${fileName}`)
				file.write(body)
				file.end()
				return `HTTP/1.1 201 Created\r\n\r\n`
			}
		}
	}
}

function sendResponse(socket, response) {
	socket.write(response)
	socket.end()
}

// Uncomment this to pass the first stage
const server = net.createServer({ keepAlive: true }, (socket) => {
	socket.on('data', (data) => {
		const request = data.toString()
		const [httpStartLine, ...httpHeadersAndRequestBody] = request.split('\r\n')
		const headers = parseRequestHeaders(httpHeadersAndRequestBody)
		const [verb, resource, protocol] = httpStartLine.split(' ')
		const body = httpHeadersAndRequestBody[httpHeadersAndRequestBody.length - 1]
		const response = createResponse({ verb, resource, protocol, headers, body })
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
