// Jacob Watson
// set up rendering environment

class Canvas {
	constructor() {
		// set up the GL canvas
		this.canvas = document.getElementById("gl-canvas")
		this.canvas.width = document.body.clientWidth

		document.addEventListener("resize", event => {
			this.canvas.width = document.body.clientWidth
			gl.viewport(0, 0, this.canvas.width, this.canvas.height)
		})

		// use webgl2 b/c its closer to normal opengl, which i'm more used to
		const gl = this.gl = this.canvas.getContext("webgl2")
		this.gpuName = this.getGPUName()

		this.shadowmapPreviewCascade = 0
		this.depthProjectionMatrix = []
		this.depthViewMatrix = []
		this.shadowFramebuffer = []
		this.shadowTexture = []
		this.biasMatrix = flatten(
			mult(
				translate(vec3(0.5, 0.5, 0.5)),
				scalem(vec3(0.5, 0.5, 0.5))
			)
		)
		this.cascades = 4

		this.boundAttribute = {}

		// create default shaadowmap
		this.createShadowmap(2048, 2048, 0)
		this.createShadowmap(2048, 2048, 1)
		this.createShadowmap(2048, 2048, 2)
		this.createShadowmap(2048, 2048, 3)

		// init standard GL stuff
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.viewport(0, 0, this.canvas.width, this.canvas.height)
		gl.enable(gl.DEPTH_TEST)
		gl.enable(gl.CULL_FACE)
		gl.cullFace(gl.BACK)

		// compile and set shader
		this.uniforms = []
		this.program = initShaders(gl, "vertex-shader", "fragment-shader")
		this.program.name = "shader1"

		this.depthProgram = initShaders(gl, "depth-vertex-shader", "depth-fragment-shader")
		this.depthProgram.name = "shader2"

		this.shadowmapPreviewProgram = initShaders(gl, "shadowmap-preview-vertex-shader", "shadowmap-preview-fragment-shader")
		this.shadowmapPreviewProgram.name = "shader3"

		gl.useProgram(this.program)
		this.attribute = []
		this.attribute["vPosition"] = gl.getAttribLocation(this.program, "vPosition")
		this.attribute["vNormal"] = gl.getAttribLocation(this.program, "vNormal")
		this.attribute["vColor"] = gl.getAttribLocation(this.program, "vColor")
		gl.enableVertexAttribArray(this.attribute["vPosition"])
		gl.enableVertexAttribArray(this.attribute["vNormal"])
		gl.enableVertexAttribArray(this.attribute["vColor"])

		this.solids = []

		this.fov = 60

		this.eyeLocation = vec3(50, 15, 0)
		this.eyeDirection = vec3(1, 0, 0)
		this.eyeTheta = 0
		this.eyePhi = 0
		this.moveSpeed = 100
		this.w = 0
		this.a = 0
		this.s = 0
		this.d = 0
		this.space = 0
		this.shift = 0

		this.sunDirection = normalize(vec3(1, -0.3, 0))
		this.sunAmbientColor = vec4(0.2, 0.2, 0.2, 1)
		this.sunDiffuseColor = vec4(1, 1, 1, 1)

		this.lastRender = performance.now()
		this.lastRenderTime = 0

		this.shadowMapFrustum = gl.createBuffer()
		this.shadowMapFrustumCount = 0

		this.drawQuads = false
		this.drawNormals = false
		this.disableShading = false
		this.hasFlashlight = true
	}

	createShadowmap(width, height, index) {
		const gl = this.gl
		this.shadowFramebuffer[index] = gl.createFramebuffer()

		// setup shadow texture
		this.shadowWidth = width
		this.shadowHeight = height
		this.shadowTexture[index] = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture[index])
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.DEPTH_COMPONENT32F,
			this.shadowWidth,
			this.shadowHeight,
			0,
			gl.DEPTH_COMPONENT,
			gl.FLOAT,
			null
		)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

		// setup shadow framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer[index])
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.DEPTH_ATTACHMENT,
			gl.TEXTURE_2D,
			this.shadowTexture[index],
			0
		)

		// error check framebuffer
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.log("The created frame buffer is invalid: " + status.toString())
		}

		// we're done setting up the framebuffer, so load up the default framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	}

	render(time) {
		const gl = this.gl
		const program = this.program

		const startTime = time ? time : 0
		const deltaTime = ((startTime - this.lastRender) + this.lastRenderTime) / 1000

		document.getElementById("info").innerHTML = `${(1 / deltaTime).toFixed(1)} FPS<br>${this.lastRenderTime | 0}ms<br>${this.terrain.totalVertexCount / 3 + this.solids.reduce((total, value) => total + value.vertexCount, 0) / 3} triangles<br>GPU: ${this.gpuName}`

		this.eyePhi = Math.min(Math.max(this.eyePhi, -Math.PI / 2 + 0.01), Math.PI / 2 - 0.01)

		this.eyeDirection = vec3(
			Math.cos(this.eyeTheta) * Math.cos(this.eyePhi),
			Math.sin(this.eyePhi),
			Math.sin(this.eyeTheta) * Math.cos(this.eyePhi),
		)

		const rightEyeDirection = normalize(cross(this.eyeDirection, vec3(0, 1, 0)))
		this.eyeLocation = add(
			this.eyeLocation,
			add(
				add(
					scale((this.w - this.s) * deltaTime * this.moveSpeed, this.eyeDirection),
					scale((this.d - this.a) * deltaTime * this.moveSpeed, rightEyeDirection)
				),
				scale((this.space - this.shift) * deltaTime * this.moveSpeed, vec3(0, 1, 0))
			)
		)

		const navPoint = document.getElementById("nav-point")

		const navPointX = (this.eyeLocation[0] / this.terrain.sizeX) * 100
		const navPointY = (this.eyeLocation[2] / this.terrain.sizeY) * 100
		navPoint.style.top = `${2 + navPointY}px`
		navPoint.style.left = `${2 + navPointX}px`

		if(
			navPointX < 0
			|| navPointX > 100
			|| navPointY < 0
			|| navPointY > 100
		) {
			navPoint.style.display = "none"
		}
		else {
			navPoint.style.display = "block"
		}

		if(!this.disableShadows) {
			this.shadowLines = []

			let size = 2000, far = 5000
			for(let i = 0; i < this.cascades; i++) {
				if(this.cascades - 1 == i) {
					size = 12000
				}

				this.renderShadowmap(size, 24000, i)
				size += 2000
				far += 5000
			}
		}
		
		gl.useProgram(program)

		// clear the screen
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
		gl.viewport(0, 0, this.canvas.width, this.canvas.height)

		// bind the shadowmap
		const textures = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4, gl.TEXTURE5]
		for(let i = 0; i < this.cascades; i++) {
			gl.activeTexture(textures[i])
			gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture[i])
			gl.uniform1i(this.getUniformLocation(program, `shadowmap[${i}]`), i)
		}

		// apply shadow projection matrix
		for(let i = 0; i < this.cascades; i++) {
			gl.uniformMatrix4fv(
				this.getUniformLocation(program, `shadowProjectionMatrix[${i}]`),
				false,
				this.depthProjectionMatrix[i]
			)
		}

		// apply shadow view matrix
		for(let i = 0; i < this.cascades; i++) {
			gl.uniformMatrix4fv(
				this.getUniformLocation(program, `shadowViewMatrix[${i}]`),
				false,
				this.depthViewMatrix[i]
			)
		}

		// apply shadow bias matrix
		gl.uniformMatrix4fv(
			this.getUniformLocation(program, "biasMatrix"),
			false,
			this.biasMatrix
		)

		// projection matrix
		const projectionMatrix = perspective(this.fov, this.canvas.width / this.canvas.height, 0.1, 25000)
		const viewMatrix = lookAt(
			this.eyeLocation,
			add(this.eyeLocation, this.eyeDirection),
			vec3(0, 1, 0.0001)
		)

		// apply projection matrix
		gl.uniformMatrix4fv(
			this.getUniformLocation(program, "projectionMatrix"),
			false,
			flatten(projectionMatrix)
		)

		// apply view matrix
		gl.uniformMatrix4fv(
			this.getUniformLocation(program, "viewMatrix"),
			false,
			flatten(viewMatrix)
		)

		// apply sun direction
		gl.uniform3fv(
			this.getUniformLocation(program, "sunDirection"),
			flatten(this.sunDirection)
		)

		// apply sun ambient color
		gl.uniform4fv(
			this.getUniformLocation(program, "sunAmbientColor"),
			flatten(this.sunAmbientColor)
		)

		// apply sun direct color
		gl.uniform4fv(
			this.getUniformLocation(program, "sunDiffuseColor"),
			flatten(this.sunDiffuseColor)
		)

		gl.uniform1i(this.getUniformLocation(program, "isShaderless"), this.disableShading ? 1 : 0)
		gl.uniform1i(this.getUniformLocation(program, "isShadowless"), this.disableShadows ? 1 : 0)
		gl.uniform1i(this.getUniformLocation(program, "hasFlashlight"), this.hasFlashlight ? 1 : 0)
		gl.uniform1i(this.getUniformLocation(program, "projectShadowmap"), this.projectShadowmap ? 1 : 0)
		gl.uniform1i(this.getUniformLocation(program, "showCascades"), this.showCascades ? 1 : 0)
		
		// render the terrain
		this.terrain.draw(program)

		// render the solids
		for(const solid of this.solids) {
			solid.draw(program, deltaTime)
		}

		// render the shadowmap frustum
		if(canvas.drawShadowmapFrustum) {
			gl.uniform1i(this.getUniformLocation(program, "isLine"), 1)

			this.boundAttribute["vPosition"] = this.shadowMapFrustum
			gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowMapFrustum)
			const vPosition = gl.getAttribLocation(program, "vPosition")
			gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0)
			gl.enableVertexAttribArray(vPosition)

			const modelMatrix = translate(vec3(0, 0, 0))
			gl.uniformMatrix4fv(
				this.getUniformLocation(program, "modelMatrix"),
				false,
				flatten(modelMatrix)
			)

			gl.drawArrays(gl.LINES, 0, this.shadowMapFrustumCount)
		}

		// render shadowmap preview
		gl.useProgram(this.shadowmapPreviewProgram)
		this.shadowmapPreview?.draw(this.shadowmapPreviewProgram)

		// request next frame using v-sync
		window.requestAnimationFrame(this.render.bind(this))

		this.lastRender = performance.now()
		this.lastRenderTime = this.lastRender - startTime
	}

	renderShadowmap(size, far, index) {
		const gl = this.gl
		const program = this.depthProgram

		gl.useProgram(program)

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer[index])

		gl.viewport(0, 0, this.shadowWidth, this.shadowHeight)
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		const sizeX = size
		const sizeY = size
		const near = 0.01
		this.depthProjectionMatrix[index] = flatten(ortho(-sizeX, sizeX, -sizeY, sizeY, near, far))

		// const camera = vec3(-200, 10, this.terrain.sizeY / 2)
		if(!this.lockShadowmap) {
			this.shadowEyeLocation = this.eyeLocation	
		}

		const camera = add(
			vec3(this.shadowEyeLocation[0], 0, this.shadowEyeLocation[2]),
			scale(-far / 2, this.sunDirection)
		)
		const rightVector = normalize(cross(this.sunDirection, vec3(0, 1, 0)))
		const upVector = normalize(cross(rightVector, this.sunDirection))
		this.depthViewMatrix[index] = flatten(
				lookAt(
					camera,
					add(
						camera,
						this.sunDirection
					),
					vec3(0, 1, 0.0001)
			)
		)

		// set up the frustum line buffer so we can visualize the shadow map projection
		const topRight = add(
			add(
				add(
					scale(sizeX, rightVector),
					scale(sizeY, upVector)
				),
				scale(near, this.sunDirection)
			),
			camera
		)

		const topLeft = add(
			add(
				add(
					scale(-sizeX, rightVector),
					scale(sizeY, upVector)
				),
				scale(near, this.sunDirection)
			),
			camera
		)

		const bottomRight = add(
			add(
				add(
					scale(sizeX, rightVector),
					scale(-sizeY, upVector)
				),
				scale(near, this.sunDirection)
			),
			camera
		)

		const bottomLeft = add(
			add(
				add(
					scale(-sizeX, rightVector),
					scale(-sizeY, upVector)
				),
				scale(near, this.sunDirection)
			),
			camera
		)

		this.shadowLines.push(topRight)
		this.shadowLines.push(add(topRight, scale(far, this.sunDirection)))

		this.shadowLines.push(topLeft)
		this.shadowLines.push(add(topLeft, scale(far, this.sunDirection)))

		this.shadowLines.push(bottomRight)
		this.shadowLines.push(add(bottomRight, scale(far, this.sunDirection)))

		this.shadowLines.push(bottomLeft)
		this.shadowLines.push(add(bottomLeft, scale(far, this.sunDirection)))

		this.shadowLines.push(topRight)
		this.shadowLines.push(topLeft)

		this.shadowLines.push(topLeft)
		this.shadowLines.push(bottomLeft)

		this.shadowLines.push(bottomLeft)
		this.shadowLines.push(bottomRight)

		this.shadowLines.push(bottomRight)
		this.shadowLines.push(topRight)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.shadowMapFrustum)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(this.shadowLines), gl.STATIC_DRAW)
		this.shadowMapFrustumCount = this.shadowLines.length

		// apply projection matrix
		gl.uniformMatrix4fv(
			this.getUniformLocation(program, "projectionMatrix"),
			false,
			this.depthProjectionMatrix[index]
		)

		// apply view matrix
		gl.uniformMatrix4fv(
			this.getUniformLocation(program, "viewMatrix"),
			false,
			this.depthViewMatrix[index]
		)

		// render the terrain
		this.terrain.draw(program)

		// render the solids
		for(const solid of this.solids) {
			solid.draw(program)
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
	}

	// memoize getting uniforms
	getUniformLocation(program, name) {
		if(!this.uniforms[program.name]) {
			this.uniforms[program.name] = []
		}

		if(this.uniforms[program.name][name] === undefined) {
			this.uniforms[program.name][name] = this.gl.getUniformLocation(program, name)
		}

		return this.uniforms[program.name][name]
	}

	getGPUName() {
		let gpuName = undefined
		if(this.gl) {
			const dbgRenderInfo = this.gl.getExtension("WEBGL_debug_renderer_info")
			if(dbgRenderInfo != null)  {
				gpuName = this.gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL)
			}
		
			return gpuName
		}
		else {
			return "No GPU?"
		}
	}
}