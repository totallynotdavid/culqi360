import {
  ShaderMaterial,
  type IUniform,
  type ShaderMaterialParameters,
} from "three";

/**
 * A ShaderMaterial whose `uniforms` have the exact keys it was built with.
 * Three types `uniforms` as an open string index, so every read is
 * `IUniform | undefined` under `noUncheckedIndexedAccess`.
 */
export class UniformMaterial<Name extends string> extends ShaderMaterial {
  declare uniforms: Record<Name, IUniform>;

  // The narrower parameter type lets TypeScript infer `Name` from `uniforms`.
  // oxlint-disable-next-line no-useless-constructor
  constructor(
    parameters: ShaderMaterialParameters & {
      uniforms: Record<Name, IUniform>;
    },
  ) {
    super(parameters);
  }
}
