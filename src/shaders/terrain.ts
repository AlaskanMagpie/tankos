export const terrainVertexShader = `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const terrainFragmentShader = `
  precision highp float;

  varying vec3 vWorldPos;

  void main() {
    float dunes = sin(vWorldPos.x * 0.018) * cos(vWorldPos.z * 0.021);
    float ripples = sin(vWorldPos.x * 0.14 + vWorldPos.z * 0.09) * 0.08;
    float tone = clamp(0.5 + dunes * 0.45 + ripples, 0.0, 1.0);

    vec3 darkSand = vec3(0.21, 0.08, 0.03);
    vec3 brightSand = vec3(0.62, 0.24, 0.05);
    vec3 col = mix(darkSand, brightSand, tone);

    float scan = 0.96 + 0.04 * sin(gl_FragCoord.y * 1.8);
    gl_FragColor = vec4(col * scan, 1.0);
  }
`;
