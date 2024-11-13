precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTextureDay;
uniform sampler2D uTextureNight;
uniform sampler2D uTextureClouds;
uniform sampler2D uTextureStars;
uniform float phi_offset;
uniform float theta_offset;
uniform float zoom;
uniform float aspect_ratio;
uniform float cloud_offset;
uniform float earth_rotation;
uniform float sun_phi;
uniform float sun_theta;
uniform float atmosphere_height;
uniform float atmosphere_intensity;

const float PI = 3.1415;
const float PI2 = PI * 2.0;
const int steps = 1000;


vec4 floatToColor(float value) {
    return vec4(value, value, value, 1.0);
}

float magnitudeSquared(vec3 v) {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

vec3 rotateVectorX(vec3 v, float angle) {
    mat3 rotationX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(angle), -sin(angle),
        0.0, sin(angle), cos(angle)
    );
    return rotationX * v;
}

vec3 rotateVectorY(vec3 v, float angle) {
    mat3 rotationY = mat3(
        cos(angle), 0.0, sin(angle),
        0.0, 1.0, 0.0,
        -sin(angle), 0.0, cos(angle)
    );
    return rotationY * v;
}

vec3 rotateVectorZ(vec3 v, float angle) {
    mat3 rotationZ = mat3(
        cos(angle), -sin(angle), 0.0,
        sin(angle), cos(angle), 0.0,
        0.0, 0.0, 1.0
    );
    return rotationZ * v;
}

vec3 rotateVector(vec3 v, float angleX, float angleY, float angleZ) {
    v = rotateVectorX(v, angleX);
    v = rotateVectorY(v, angleY);
    v = rotateVectorZ(v, angleZ);
    return v;
}

float calculatePhi(float x, float z) {
    return (abs(x) / x * acos(z / sqrt(z * z + x * x))) / PI2;
}

float calculateTheta(float x, float y, float z) {
    return acos(y / sqrt(x * x + y * y + z * z)) / PI;
}

vec3 getSphereCoordinates(vec2 uv, float radius) {
    float x = uv.x * aspect_ratio;
    float y = uv.y;
    float z = sqrt(radius * radius - x * x - y * y);
    return vec3(x, y, z);
}

float getThirdSphereCoordinate(float x,float y,float r){
    return sqrt(r*r-x*x-y*y);
}

vec4 getDayNightCloudColor(float earth_phi, float cloud_phi, float theta, float alpha, float cloudAlpha) {
    vec4 dayColor = texture2D(uTextureDay, vec2(earth_phi, theta));
    vec4 nightColor = texture2D(uTextureNight, vec2(earth_phi, theta));
    vec4 cloudColor = texture2D(uTextureClouds, vec2(cloud_phi, theta));
    return mix(nightColor, dayColor, alpha) + alpha * cloudColor * cloudAlpha;
}

float mapRange(float value, float inMin, float inMax, float outMin, float outMax) {
    return clamp((value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin, outMin, outMax);
}

vec4 getStarColor(vec2 uv, float phi, float theta) {
    return texture2D(uTextureStars, vec2(phi, theta)) * 0.5;
}

vec3 applyRotations(vec3 v) {
    vec3 rotatedCoords = rotateVector(v, PI * theta_offset, PI * phi_offset, 0.0);
    vec3 sunRotatedCoords = rotateVectorZ(rotateVectorY(vec3(rotatedCoords), sun_phi), sun_theta);
    return sunRotatedCoords;
}

float getDistanceThroughAtmosphere(vec3 sphereCoords, vec3 atmosphereEnterCoords, float earthRadius, float atmosphereRadius) {
    float screenLength = sqrt(sphereCoords.x * sphereCoords.x + sphereCoords.y * sphereCoords.y);
    float distanceThroughAtmosphere = 0.0;
    if (screenLength < earthRadius) {
        distanceThroughAtmosphere = atmosphereEnterCoords.z - sphereCoords.z;
    }
    else if (screenLength < atmosphereRadius) {
        distanceThroughAtmosphere = atmosphereEnterCoords.z * 2.0;
    }
    else {
        distanceThroughAtmosphere = 0.0;
    }
    return distanceThroughAtmosphere;
}

float getDistanceToSun(vec3 sunRotatedCoords, float earthRadius, float atmosphereRadius) {
    float distanceToSun = 0.0;

    float leavingPoint = getThirdSphereCoordinate(sunRotatedCoords.y, sunRotatedCoords.z, atmosphereRadius);

    if (sunRotatedCoords.x > 0.0) {
        distanceToSun =  leavingPoint - sunRotatedCoords.x;
    }
    else if (sunRotatedCoords.y*sunRotatedCoords.y + sunRotatedCoords.z*sunRotatedCoords.z > earthRadius*earthRadius) {
        distanceToSun =  leavingPoint - sunRotatedCoords.x;
    }
    else {
        distanceToSun = 10000000000000.0;
    }
    return distanceToSun;
}

float densityAtPoint(vec3 point, float earthRadius, float atmosphereRadius) {
    float mag = sqrt(magnitudeSquared(point));
    return mapRange(mag, atmosphereRadius,earthRadius , 0.0, 1.0);
}

vec4 getAtmosphereColor(vec2 uv, float atmosphereRadius, float earthRadius, vec3 sunDirection) {

    vec3 sphereCoords = getSphereCoordinates(uv, earthRadius);
    vec3 atmosphereEnterCoords = getSphereCoordinates(uv, atmosphereRadius);

    float distanceThroughAtmosphere = getDistanceThroughAtmosphere(sphereCoords, atmosphereEnterCoords, earthRadius, atmosphereRadius);

    float atmosphereEnterDepth = atmosphereEnterCoords.z;
    float atmosphereLeaveDepth = atmosphereEnterCoords.z + distanceThroughAtmosphere;
    
    // int steps = 10;
    float intensity = 0.0;
    float stepsize = (atmosphereLeaveDepth - atmosphereEnterDepth) / float(steps);

    float x = sphereCoords.x;
    float y = sphereCoords.y;
    float z = atmosphereEnterDepth;
    for (int i = 0; i < steps; i++) {
        z -= stepsize;
        vec3 rotatedCoords = applyRotations(vec3(x, y, z));
        intensity += exp(-getDistanceToSun(rotatedCoords, earthRadius, atmosphereRadius)) * densityAtPoint(rotatedCoords, earthRadius, atmosphereRadius) * stepsize;
    }

    float alpha = intensity*atmosphere_intensity;
    return floatToColor(alpha);
}

void main() {
    vec2 uv = (vTexCoord - 0.5) * zoom;
    float radius = 0.5;

    vec3 sphereCoords = getSphereCoordinates(uv, radius);
    vec3 rotatedCoords = rotateVector(sphereCoords, PI * theta_offset, PI * phi_offset, 0.0);
    vec3 sunRotatedCoords = rotateVectorZ(rotateVectorY(vec3(rotatedCoords), sun_phi), sun_theta);

    float phi = mod(calculatePhi(rotatedCoords.x, rotatedCoords.z), 1.0);
    float theta = mod(calculateTheta(rotatedCoords.x, rotatedCoords.y, rotatedCoords.z), 1.0);

    float cloud_phi = mod(phi + cloud_offset, 1.0);
    float earth_phi = mod(phi + earth_rotation, 1.0);

    if (sphereCoords.x * sphereCoords.x + sphereCoords.y * sphereCoords.y < radius * radius) {

        float alpha = mapRange(sunRotatedCoords.x - 0.05, -0.1, 0.1, 0.0, 1.0);
        float cloudAlpha = mapRange(zoom, 0.1, 0.3, 0.0, 1.0);

        gl_FragColor = getDayNightCloudColor(earth_phi, cloud_phi, theta, alpha, cloudAlpha);
    } else {
        vec2 newUv = vTexCoord - 0.5;
        sphereCoords = getSphereCoordinates(newUv, radius * aspect_ratio * 1.5);
        rotatedCoords = rotateVector(sphereCoords, PI * -theta_offset, PI * -phi_offset, 0.0);

        phi = mod(calculatePhi(rotatedCoords.x, rotatedCoords.z), 1.0);
        theta = mod(calculateTheta(rotatedCoords.x, rotatedCoords.y, rotatedCoords.z), 1.0);

        gl_FragColor = getStarColor(newUv, phi, theta);
    }

    // gl_FragColor *= 0.6;
    gl_FragColor += getAtmosphereColor(uv, radius+atmosphere_height, radius, sunRotatedCoords);
}
