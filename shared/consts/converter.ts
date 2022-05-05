import { AllMeasures, allMeasures, AllMeasuresSystems, AllMeasuresUnits, initConverter } from "../../types";

export const converter = initConverter<AllMeasures, AllMeasuresSystems, AllMeasuresUnits>(allMeasures);
