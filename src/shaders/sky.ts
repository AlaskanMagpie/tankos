export const skyVertexShader = `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const skyFragmentShader = `
  precision highp float;

  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 low = vec3(0.35, 0.12, 0.03);
    vec3 mid = vec3(0.73, 0.31, 0.07);
    vec3 high = vec3(0.94, 0.71, 0.44);

    vec3 sky = mix(low, mid, smoothstep(0.0, 0.55, h));
    sky = mix(sky, high, smoothstep(0.55, 1.0, h));

    float haze = smoothstep(-0.2, 0.45, dir.y);
    sky = mix(vec3(0.23, 0.09, 0.04), sky, haze);

    float sun = pow(max(dot(dir, normalize(vec3(-0.35, 0.34, -0.87))), 0.0), 28.0);
    sky += vec3(0.9, 0.7, 0.35) * sun * 0.7;

    gl_FragColor = vec4(sky, 1.0);
  }
`;
