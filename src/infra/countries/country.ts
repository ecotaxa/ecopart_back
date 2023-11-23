import { CountriesWrapper } from "./country-wrapper";


export class CountriesAdapter implements CountriesWrapper {
    countries = require("i18n-iso-countries");

    listCountries(): any {
        return this.countries;
    }


}