// Jacob Watson

class Terrain {
	constructor(canvas) {
		this.canvas = canvas

		this.vertexBuffer = canvas.gl.createBuffer()
		this.normalBuffer = canvas.gl.createBuffer()
		this.colorBuffer = canvas.gl.createBuffer()
		this.vertexCount = 0

		this.skirtVertexBuffer = canvas.gl.createBuffer()
		this.skirtNormalBuffer = canvas.gl.createBuffer()
		this.skirtColorBuffer = canvas.gl.createBuffer()
		this.skirtVertexCount = 0

		this.height = 0
		this.lineBuffer = canvas.gl.createBuffer()
		this.lineCount = 0

		this.ambientColor = vec4(1, 0, 0, 1)
		this.diffuseColor = vec4(1, 0, 0, 1)
	}

	generatePerlin(width, height, scale) {
		noise.seed(Math.random())

		this.terrain = []
		this.colors = []

		const canvas = document.getElementById("perlin-canvas")
		const context = canvas.getContext("2d")
		this.width = canvas.width = width
		this.height = canvas.height = height
		
		const image = context.getImageData(0, 0, width, height)
		const pixels = image.data

		// generate terrain
		for(let x = 0; x < width; x++) {
			this.terrain[x] = []
			for(let y = 0; y < height; y++) {
				const value = (noise.simplex2(x / scale, y / scale) + 1) / 2 + noise.perlin2(x / scale, y / scale) * 2

				this.terrain[x][y] = value
				const offset = (y * width + x) * 4
				pixels[offset] = Math.floor(value * 255)
				pixels[offset + 1] = Math.floor(value * 255)
				pixels[offset + 2] = Math.floor(value * 255)
				pixels[offset + 3] = 255
			}
		}

		// generate colors
		noise.seed(Math.random())
		for(let x = 0; x < width; x++) {
			this.colors[x] = []
			for(let y = 0; y < height; y++) {
				const value = (noise.perlin2(x / scale, y / scale) + 1) / 2
				this.colors[x][y] = value
			}
		}

		context.putImageData(image, 0, 0)
	}

	plantTree() {
		const xIndex = Math.floor(Math.random() * this.width)
		const yIndex = Math.floor(Math.random() * this.height)
		const height = this.terrain[xIndex][yIndex]
		
		const object = new Object(canvas, "./tree.obj")
		object.location = vec3(xIndex * this.scaleX, height * this.scaleHeight, yIndex * this.scaleY)
		const scale = getRandomFloat(3, 6)
		object.scale = vec3(scale, scale, scale)
	}

	generateGeometry(scaleX, scaleY, scaleHeight) {
		this.sizeX = this.width * scaleX
		this.sizeY = this.height * scaleY

		this.scaleX = scaleX
		this.scaleY = scaleY
		this.scaleHeight = scaleHeight
		
		const gl = this.canvas.gl
		const triangles = []
		const normals = []
		const colors = []
		const lines = []

		const skirtTriangles = []
		const skirtNormals = []
		const skirtColors = []

		const createTriangleFactory = (array, colorArray) => {
			return (point1, point2, point3, color1, color2, color3) => {
				point1.normal = vec3(0, 0, 0)
				point2.normal = vec3(0, 0, 0)
				point3.normal = vec3(0, 0, 0)
				
				array.push(point1)
				array.push(point2)
				array.push(point3)

				colorArray.push(color1)
				colorArray.push(color2)
				colorArray.push(color3)
			}
		}

		const createTriangle = createTriangleFactory(triangles, colors)
		const createSkirtTriangle = createTriangleFactory(skirtTriangles, skirtColors)

		const lerp = (color1, color2, percent) => {
			return vec4(
				(1 - percent) * color1[0] + color2[0] * percent,
				(1 - percent) * color1[1] + color2[1] * percent,
				(1 - percent) * color1[2] + color2[2] * percent,
				1
			)
		}

		// convert terrain into vector 3's
		const points = []
		for(let x = 0; x < this.width; x++) {
			points[x] = []
			for(let y = 0; y < this.height; y++) {
				points[x][y] = vec3(
					x * scaleX,
					this.terrain[x][y] * scaleHeight,
					y * scaleY
				)
			}
		}

		const firstGreen = vec4(169 / 255, 224 / 255, 92 / 255, 1)
		const secondGreen = vec4(71 / 255, 135 / 255, 51 / 255, 1)

		// generate terrain
		for(let x = 1; x < this.width; x++) {
			const firstArray = points[x - 1]
			const secondArray = points[x]

			const firstColorArray = this.colors[x - 1]
			const secondColorArray = this.colors[x]

			for(let y = 1; y < firstArray.length; y++) {
				const a1 = firstArray[y - 1]
				const b1 = firstArray[y]
				const a2 = secondArray[y - 1]
				const b2 = secondArray[y]

				const colora1 = lerp(firstGreen, secondGreen, firstColorArray[y - 1])
				const colorb1 = lerp(firstGreen, secondGreen, firstColorArray[y])
				const colora2 = lerp(firstGreen, secondGreen, secondColorArray[y - 1])
				const colorb2 = lerp(firstGreen, secondGreen, secondColorArray[y])

				createTriangle(a1, b1, a2, colora1, colorb1, colora2)
				createTriangle(a2, b1, b2, colora2, colorb1, colorb2)
			}
		}

		// calculate normals
		const generateNormals = (triangles, normals) => {
			for(let i = 0; i < triangles.length; i += 3) {
				const point1 = triangles[i]
				const point2 = triangles[i + 1]
				const point3 = triangles[i + 2]
				
				const normal = normalize(cross(subtract(point2, point1), subtract(point3, point1)))

				for(let i = 0; i < 3; i++) {
					if(isNaN(normal[i])) {
						normal[i] = 0
					}
				}

				point1.normal = add(point1.normal, normal)
				point2.normal = add(point2.normal, normal)
				point3.normal = add(point3.normal, normal)
			}

			// normalize normals
			for(const point of triangles) {
				for(let i = 0; i < 3; i++) {
					if(isNaN(point.normal[i])) {
						point.normal[i] = 0
					}
				}
				
				point.normal = normalize(point.normal)
				normals.push(point.normal)

				lines.push(point)
				lines.push(add(scale(20, point.normal), point))
			}
		}

		generateNormals(triangles, normals)

		// generate skirt for x axis
		const skirtHeight = 500
		const skirtColor = vec4(0.2, 0.2, 0.2, 1.0)
		const generateSkirtX = (y, reverseOrder) => {
			for(let x = 1; x < this.width; x++) {
				const firstArray = points[x - 1]
				const secondArray = points[x]

				const a1 = vec3(
					(x - 1) * scaleX,
					-skirtHeight,
					y * scaleY
				)

				const b1 = vec3(firstArray[y])

				const a2 = vec3(
					x * scaleX,
					-skirtHeight,
					y * scaleY
				)

				const b2 = vec3(secondArray[y])

				if(reverseOrder) {
					createSkirtTriangle(b2, b1, a2, skirtColor, skirtColor, skirtColor)
					createSkirtTriangle(a2, b1, a1, skirtColor, skirtColor, skirtColor)
				}
				else {
					createSkirtTriangle(a1, b1, a2, skirtColor, skirtColor, skirtColor)
					createSkirtTriangle(a2, b1, b2, skirtColor, skirtColor, skirtColor)
				}
			}
		}

		// generate skirt for y axis
		const generateSkirtY = (x, reverseOrder) => {
			for(let y = 1; y < this.height; y++) {
				const a1 = vec3(
					x * scaleX,
					-skirtHeight,
					(y - 1) * scaleY
				)

				const b1 = vec3(points[x][y - 1])

				const a2 = vec3(
					x * scaleX,
					-skirtHeight,
					y * scaleY
				)

				const b2 = vec3(points[x][y])

				if(!reverseOrder) {
					createSkirtTriangle(b2, b1, a2, skirtColor, skirtColor, skirtColor)
					createSkirtTriangle(a2, b1, a1, skirtColor, skirtColor, skirtColor)
				}
				else {
					createSkirtTriangle(a1, b1, a2, skirtColor, skirtColor, skirtColor)
					createSkirtTriangle(a2, b1, b2, skirtColor, skirtColor, skirtColor)
				}
			}
		}

		generateSkirtX(0, false)
		generateSkirtX(this.height - 1, true)

		generateSkirtY(0, false)
		generateSkirtY(this.width - 1, true)

		// create floor
		createSkirtTriangle(
			vec3((this.width - 1) * scaleX, -skirtHeight, 0),
			vec3(0, -skirtHeight, (this.height - 1) * scaleY),
			vec3(0, -skirtHeight, 0),
			skirtColor,
			skirtColor,
			skirtColor
		)

		createSkirtTriangle(
			vec3((this.width - 1) * scaleX, -skirtHeight, 0),
			vec3((this.width - 1) * scaleX, -skirtHeight, (this.height - 1) * scaleY),
			vec3(0, -skirtHeight, (this.height - 1) * scaleY),
			skirtColor,
			skirtColor,
			skirtColor
		)

		generateNormals(skirtTriangles, skirtNormals)

		// the normal terrain
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(triangles), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)

		// the skirt
		gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtVertexBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(skirtTriangles), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtNormalBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(skirtNormals), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtColorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(skirtColors), gl.STATIC_DRAW)

		// debug lines for normals
		gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(lines), gl.STATIC_DRAW)
		this.lineCount = lines.length

		this.vertexCount = triangles.length
		this.skirtVertexCount = skirtTriangles.length
		this.totalVertexCount = triangles.length + skirtTriangles.length
		console.log(`Generated ${triangles.length} triangles`)
		console.log(`Generated ${skirtTriangles.length} triangles for skirt`)
	}

	draw(program) {
		const gl = this.canvas.gl

		const modelMatrix = translate(vec3(0, 0, 0))

		{
			// bind vertex data
			this.canvas.boundAttribute["vPosition"] = this.vertexBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

			// bind normal data
			this.canvas.boundAttribute["vNormal"] = this.normalBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vNormal"], 3, gl.FLOAT, false, 0, 0)
			
			// bind color data
			this.canvas.boundAttribute["vColor"] = this.colorBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)
			
			// say its not a line
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 0)

			// apply the model-view matrix
			gl.uniformMatrix4fv(
				this.canvas.getUniformLocation(program, "modelMatrix"),
				false,
				flatten(modelMatrix)
			)

			// draw the triangles
			if(this.canvas.drawQuads) {
				gl.drawArrays(gl.LINES, 0, this.vertexCount)
			}
			else {
				gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
			}
		}

		// draw the skirt
		{
			// bind vertex data
			this.canvas.boundAttribute["vPosition"] = this.skirtVertexBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtVertexBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

			// bind normal data
			this.canvas.boundAttribute["vNormal"] = this.skirtNormalBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtNormalBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vNormal"], 3, gl.FLOAT, false, 0, 0)
			
			// bind color data
			this.canvas.boundAttribute["vColor"] = this.skirtColorBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.skirtColorBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)

			// say its not a line
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 0)

			// draw the triangles
			if(this.canvas.drawQuads) {
				gl.drawArrays(gl.LINES, 0, this.skirtVertexCount)
			}
			else {
				gl.drawArrays(gl.TRIANGLES, 0, this.skirtVertexCount)
			}
		}

		if(this.canvas.drawNormals) {
			// bind line data
			this.canvas.boundAttribute["vPosition"] = this.lineBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

			// apply line uniform
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 1)

			// draw the lines
			gl.drawArrays(gl.LINES, 0, this.lineCount)
		}
	}
}