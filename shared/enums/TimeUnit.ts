import {hours, milliseconds, minutes, seconds, ticks} from "./howMany";

/**
 * A distinct unit of time measurement.
 */
export enum UnitType
{
	Ticks,
	Milliseconds,
	Seconds,
	Minutes,
	Hours,
	Days
} // Earth Days

/**
 * Converts any TimeUnit value to it's respective millisecond quantity.
 * @param {number} value
 * @param {UnitType} units
 * @return {number} Number of milliseconds representing the specified units.
 */
export const toMilliseconds = (
	value: number,
	units: UnitType): number =>
{
	// Noinspection FallThroughInSwitchStatementJS
	switch(units)
	{
		case UnitType.Days:
			value *= hours.per.day;
		case UnitType.Hours:
			value *= minutes.per.hour;
		case UnitType.Minutes:
			value *= seconds.per.minute;
		case UnitType.Seconds:
			value *= milliseconds.per.second;
		case UnitType.Milliseconds:
			return value;
		case UnitType.Ticks:
			return value/ticks.per.millisecond;
		default:
			throw new Error("Invalid TimeUnit.");
	}
};

/**
 * Converts milliseconds to the specified TimeUnit quantity.
 * @param {number} ms
 * @param {UnitType} units
 * @return {number}
 */
export const fromMilliseconds = (
	ms: number,
	units: UnitType): number =>
{
	switch(units)
	{
		case UnitType.Days:
			return ms/milliseconds.per.day;
		case UnitType.Hours:
			return ms/milliseconds.per.hour;
		case UnitType.Minutes:
			return ms/milliseconds.per.minute;
		case UnitType.Seconds:
			return ms/milliseconds.per.second;
		case UnitType.Milliseconds:
			return ms;
		case UnitType.Ticks:
			return ms*ticks.per.millisecond;
		default:
			throw new Error("Invalid TimeUnit.");
	}
};

Object.freeze(UnitType);
