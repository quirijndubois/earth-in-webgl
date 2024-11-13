function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function mapRange(value, inMin, inMax, outMin, outMax) {
    return clamp((value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin, outMin, outMax);
}

function addSlider(variable, min, max, location, name, step = 0.01) {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = variable;
    slider.step = step;
    slider.addEventListener("input", () => {
        variable = slider.value;
        gl.uniform1f(location, variable);
        console.log(variable);
    });
    const label = document.createElement("label");
    label.textContent = name;
    label.htmlFor = slider.id;
    document.body.appendChild(label);
    document.body.appendChild(slider);
}

function addCheckbox(variable, location, name) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = variable;
    checkbox.addEventListener("change", () => {
        variable = checkbox.checked;
        gl.uniform1f(location, variable);
    });
    const label = document.createElement("label");
    label.textContent = name;
    label.htmlFor = checkbox.id;
    document.body.appendChild(label);
    document.body.appendChild(checkbox);
}

const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Helper function to load shaders from external files
async function loadShaderSource(url) {
    const response = await fetch(url);
    return response.text();
}

// Function to create and link shaders into a program
async function initShaders() {
    const vertexShaderSource = await loadShaderSource('vertexShader.glsl');
    const fragmentShaderSource = await loadShaderSource('fragmentShader.glsl');

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Unable to initialize the shader program:", gl.getProgramInfoLog(program));
        return null;
    }

    gl.useProgram(program);
    return program;
}

// Create and compile shader
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Initialize shaders and WebGL program
(async () => {
    const program = await initShaders();
    if (!program) return;

    // Uniform locations
    const phiOffsetLocation = gl.getUniformLocation(program, "phi_offset");
    const thetaOffsetLocation = gl.getUniformLocation(program, "theta_offset");
    const zoomLocation = gl.getUniformLocation(program, "zoom");
    const resolutionLocation = gl.getUniformLocation(program, "resolution");
    const aspectRatioLocation = gl.getUniformLocation(program, "aspect_ratio");
    const cloudOffsetLocation = gl.getUniformLocation(program, "cloud_offset");
    const earthRotationLocation = gl.getUniformLocation(program, "earth_rotation");
    const sunPhiLocation = gl.getUniformLocation(program, "sun_phi");
    const sunThetaLocation = gl.getUniformLocation(program, "sun_theta");
    const atmosphereHeightLocation = gl.getUniformLocation(program, "atmosphere_height");
    const atmosphereIntensityLocation = gl.getUniformLocation(program, "atmosphere_intensity");
    const atmosphereDensityFallOffLocation = gl.getUniformLocation(program, "atmosphere_density_falloff");
    const atmosphereStepCountLocation = gl.getUniformLocation(program, "STEPS");
    const toggleAtmosphereLocation = gl.getUniformLocation(program, "toggle_atmosphere");
    const toggleCloudsLocation = gl.getUniformLocation(program, "toggle_clouds");
    const toggleMapLocation = gl.getUniformLocation(program, "toggle_map");
    const toggleStarsLocation = gl.getUniformLocation(program, "toggle_stars");


    // Set initial values for uniforms
    let phiOffset = 0.972;
    let thetaOffset = 0.29;
    let zoom = 1.0;
    let aspectRatio = canvas.width / canvas.height;
    let cloudOffset = 0.0;
    let earthRotation = 0.0;
    let sunPhi = 0.0;
    let sunTheta = 0.40911;
    let atmosphere_height = 0.1;
    let atmosphere_intensity = 1;
    let atmosphere_density_falloff = 10;
    let toggleAtmosphere = true;
    let toggleClouds = true;
    let toggleMap = true;
    let toggleStars = true;
    let atmosphereStepCount = 2;

    function setAllUniforms() {
        gl.uniform1f(phiOffsetLocation, phiOffset);
        gl.uniform1f(thetaOffsetLocation, thetaOffset);
        gl.uniform1f(zoomLocation, zoom);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        gl.uniform1f(aspectRatioLocation, aspectRatio);
        gl.uniform1f(cloudOffsetLocation, cloudOffset);
        gl.uniform1f(earthRotationLocation, earthRotation);
        gl.uniform1f(sunPhiLocation, sunPhi);
        gl.uniform1f(sunThetaLocation, sunTheta);
        gl.uniform1f(atmosphereHeightLocation, atmosphere_height);
        gl.uniform1f(atmosphereIntensityLocation, atmosphere_intensity);
        gl.uniform1f(atmosphereDensityFallOffLocation, atmosphere_density_falloff);
        gl.uniform1f(toggleAtmosphereLocation, toggleAtmosphere);
        gl.uniform1f(toggleCloudsLocation, toggleClouds);
        gl.uniform1f(toggleMapLocation, toggleMap);
        gl.uniform1f(toggleStarsLocation, toggleStars);
        gl.uniform1f(atmosphereStepCountLocation, atmosphereStepCount);
    }
    setAllUniforms();

    // Define vertices and texture coordinates
    const vertices = new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1,
    ]);

    // Create and bind the buffer
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Get attribute locations, enable them, and set pointers
    const aPosition = gl.getAttribLocation(program, "aPosition");
    const aTexCoord = gl.getAttribLocation(program, "aTexCoord");

    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 4 * 4, 0);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
    gl.enableVertexAttribArray(aTexCoord);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Load and bind textures
    const daymap = new Image();
    const nightmap = new Image();
    const clouds = new Image();
    const stars = new Image();
    daymap.src = "textures/daymap.jpg";
    nightmap.src = "textures/nightmap.jpg";
    clouds.src = "textures/clouds.jpg";
    stars.src = "textures/starmap.jpg";

    stars.onload = function () {
        loadTexture(stars, 0, gl.TEXTURE0, "uTextureStars");
    };

    daymap.onload = function () {
        loadTexture(daymap, 1, gl.TEXTURE1, "uTextureDay");
    };

    nightmap.onload = function () {
        loadTexture(nightmap, 2, gl.TEXTURE2, "uTextureNight");
    };

    clouds.onload = function () {
        loadTexture(clouds, 3, gl.TEXTURE3, "uTextureClouds");
    };

    function loadTexture(image, index, texture, name) {
        gl.activeTexture(texture);
        const textureToCreate = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textureToCreate);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.uniform1i(gl.getUniformLocation(program, name), index);
    }

    function render() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function startAnimation() {
        render();
        cloudOffset -= 0.0002;
        earthRotation -= 0.0003;
        let delta = mapRange(zoom, 0.2, 0.4, -0.0006, 0);
        phiOffset += delta;

        gl.uniform1f(phiOffsetLocation, phiOffset);
        gl.uniform1f(cloudOffsetLocation, cloudOffset);
        gl.uniform1f(earthRotationLocation, earthRotation);
        requestAnimationFrame(startAnimation);
    }
    startAnimation();

    // Handle user interactions
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    canvas.addEventListener("mousedown", (event) => {
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
    });

    canvas.addEventListener("mousemove", (event) => {
        if (isDragging) {
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            phiOffset += deltaX / 1000 * zoom;
            thetaOffset += deltaY / 1000 * zoom;
            gl.uniform1f(thetaOffsetLocation, thetaOffset);
            startX = event.clientX;
            startY = event.clientY;
        }
    });

    canvas.addEventListener("mouseup", () => {
        isDragging = false;
    });

    canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        zoom = clamp(zoom * (1 + event.deltaY / 1000), 0.1, 10);
        gl.uniform1f(zoomLocation, zoom);
    });

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        aspectRatio = canvas.width / canvas.height;
        gl.uniform1f(aspectRatioLocation, aspectRatio);
    });

    addSlider(sunPhi, -Math.PI, Math.PI, sunPhiLocation, "Sun Rotation");
    addSlider(sunTheta, -0.5 * Math.PI, 0.5 * Math.PI, sunThetaLocation, "Sun Inclination");
    addSlider(atmosphere_height, 0, 0.2, atmosphereHeightLocation, "Atmosphere Height");
    addSlider(atmosphere_intensity, 0, 5, atmosphereIntensityLocation, "Atmosphere Intensity");
    addSlider(atmosphere_density_falloff, 1, 20, atmosphereDensityFallOffLocation, "Atmosphere Density Fall Off");
    addSlider(atmosphereStepCount, 1, 3, atmosphereStepCountLocation, "Atmosphere Step Count");
    addCheckbox(toggleAtmosphere, toggleAtmosphereLocation, "Atmosphere");
    addCheckbox(toggleClouds, toggleCloudsLocation, "Clouds");
    addCheckbox(toggleMap, toggleMapLocation, "Map");
    addCheckbox(toggleStars, toggleStarsLocation, "Stars");
})();
