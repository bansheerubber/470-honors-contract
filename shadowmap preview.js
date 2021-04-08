class ShadowmapPreview {
	constructor(canvas) {
		this.canvas = canvas
		const gl = this.canvas.gl

		// buffers
		this.positionBuffer = gl.createBuffer()
		this.normalBuffer = gl.createBuffer()
		this.uvBuffer = gl.createBuffer()

		const positions = [
			vec3(-0.5, -0.5, 0), vec3(0.5, 0.5, 0), vec3(-0.5, 0.5, 0),
			vec3(-0.5, -0.5, 0), vec3(0.5, -0.5, 0), vec3(0.5, 0.5, 0)
		]

		const normals = [
			vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 0, 0),
			vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 0, 0)
		]

		const uvs = [
			vec4(0, 0, 0, 0), vec4(1, 1, 0, 0), vec4(0, 1, 0, 0),
			vec4(0, 0, 0, 0), vec4(1, 0, 0, 0), vec4(1, 1, 0, 0)
		]

		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(uvs), gl.STATIC_DRAW)

		this.vertexCount = positions.length

		// model matrix
		const scale = 150
		this.modelMatrix = flatten(
			mult(
				mult(
					translate(vec3(this.canvas.canvas.width / 2 - scale / 2 - 20, -this.canvas.canvas.height / 2 + scale / 2 + 20, 0)),
					rotate(
						0,
						vec3(1, 0, 0)
					)
				),
				scalem(scale, scale, 1),
			)
		)

		// view matrix
		this.viewMatrix = flatten(
			lookAt(
				vec3(0, 0, 1),
				vec3(0, 0, 0),
				vec3(0, 1, 0.0001)
			)
		)

		// projection matrix
		const width = this.canvas.canvas.width
		const height = this.canvas.canvas.height
		this.projectionMatrix = flatten(
			ortho(
				-width / 2,
				width / 2,
				-height / 2,
				height / 2,
				0.01,
				10
			)
		)
	}

	draw(program) {
		const gl = this.canvas.gl

		// apply the projection matrix
		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "projectionMatrix"),
			false,
			this.projectionMatrix
		)

		// apply the view matrix
		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "viewMatrix"),
			false,
			this.viewMatrix
		)

		// apply the model matrix
		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "modelMatrix"),
			false,
			this.modelMatrix
		)

		// bind vertex data
		this.canvas.boundAttribute["vPosition"] = this.positionBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

		// bind normal data
		this.canvas.boundAttribute["vNormal"] = this.normalBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vNormal"], 3, gl.FLOAT, false, 0, 0)

		// use normals as color for now
		this.canvas.boundAttribute["vColor"] = this.uvBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vColor"], 4, gl.FLOAT, false, 0, 0)

		// bind shadow texture
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, this.canvas.shadowTexture[this.canvas.shadowmapPreviewCascade])
		gl.uniform1i(this.canvas.getUniformLocation(program, `shadowmap`), 0)

		gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
	}
}