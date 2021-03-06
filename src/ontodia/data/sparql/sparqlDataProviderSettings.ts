/**
 * this is dataset-schema specific settings
 */
export interface SparqlDataProviderSettings {
    /**
     * default prefix to be used in every query
     */
    defaultPrefix: string;
    /**
     *  property to use as label in schema (classes, properties)
     */
    schemaLabelProperty: string;

    /**
     * property to use as instance label
     * todo: make it an array
     */
    dataLabelProperty: string;

    /**
     * full-text search settings
     */
    fullTextSearch: FullTextSearchSettings;

    /**
     * query to retreive class tree. Should return class, label, parent, instcount (optional)
     */
    classTreeQuery: string;

    /**
     * link types pattern - what to consider a link on initial fetch
     */
    linkTypesPattern: string;

    /**
     * query for fetching all information on element: labels, classes, properties
     */
    elementInfoQuery: string;

    /**
     * this should return image URL for ?inst as instance and ?linkType for image property IRI
     * todo: move to runtime settings instead? proxying is runtime thing
     */
    imageQueryPattern: string;

    /**
     * link types of returns possible link types from specified instance with statistics
     */
    linkTypesOfQuery: string;

    /**
     * when fetching all links from element, we could specify additional filter
     */
    filterRefElementLinkPattern: string;

    /**
     * filter by type pattern. One could use transitive type resolution here.
     */
    filterTypePattern: string;

    /**
     * how to fetch elements info when fetching data.
     */
    filterElementInfoPattern: string;

    /**
     * imposes additional filtering on elements within filter
     */
    filterAdditionalRestriction: string;

    /**
     * extract search query pattern
     */
    extractSearchPattern?: string;

    /**
     * contain search query pattern
     */
    containSearchPattern?: string;

    /**
     * fuzzy search query pattern
     */
    fuzzySearchPattern?: string;

    /**
     * boolean search query pattern
     */
    booleanSearchPattern?: string;     
}

/**
 * Full text search settings,
 * developer could use anything from search extensions of triplestore to regular expressions match
 * See wikidata and dbpedia examples for reusing full text search capabilities of Blazegraph and Virtuozo
 */
export interface FullTextSearchSettings {
    /**
     * prefix to use in FTS queries
     */
    prefix: string;

    /**
     * query pattern should return ?inst and ?score for given ${text}.
     */
    queryPattern: string;

    /**
     * try to extract label from IRI for usage in search purposes.
     * If you have no labels in the dataset and want to search, you
     * can use ?extractedLabel as something to search for.
     */
    extractLabel?: boolean;
}

export const WikidataSettings: SparqlDataProviderSettings = {
    defaultPrefix:
        `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
 PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
 PREFIX wdt: <http://www.wikidata.org/prop/direct/>
 PREFIX wd: <http://www.wikidata.org/entity/>
 PREFIX owl:  <http://www.w3.org/2002/07/owl#>

`,

    schemaLabelProperty: 'rdfs:label',
    dataLabelProperty: 'rdfs:label',

    fullTextSearch: {
        prefix: 'PREFIX bds: <http://www.bigdata.com/rdf/search#>' + '\n',
        queryPattern: ` 
              ?inst rdfs:label ?searchLabel. 
              SERVICE bds:search {
                     ?searchLabel bds:search "\${text}*" ;
                                  bds:minRelevance '0.5' ;
                                  bds:matchAllTerms 'true' .
              }
              BIND(IF(STRLEN(?strInst) > 33,
                            0-<http://www.w3.org/2001/XMLSchema#integer>(SUBSTR(?strInst, 33)),
                            -10000) as ?score)
            `,
    },

    classTreeQuery: `
            SELECT distinct ?class ?label ?parent WHERE {
              ?class rdfs:label ?label.                            
              { ?class wdt:P279 wd:Q35120. }
                UNION 
              { ?parent wdt:P279 wd:Q35120.
                ?class wdt:P279 ?parent. }
                UNION 
              { ?parent wdt:P279/wdt:P279 wd:Q35120.
                ?class wdt:P279 ?parent. }
            }
        `,

    // todo: think more, maybe add a limit here?
    linkTypesPattern: `?link wdt:P279* wd:Q18616576.
    BIND(0 as ?instcount)
`,

    elementInfoQuery: `
            SELECT ?inst ?class ?label ?propType ?propValue
            WHERE {
                OPTIONAL {
                    { ?inst wdt:P31 ?class } UNION
                    { ?inst wdt:P31 ?realClass .
                        ?realClass wdt:P279 | wdt:P279/wdt:P279 ?class }
                }
                OPTIONAL {?inst rdfs:label ?label}
                OPTIONAL {
                    ?inst ?propType ?propValue .
                    FILTER (isLiteral(?propValue))
                }
            } VALUES (?inst) {\${ids}}
        `,
    imageQueryPattern: ` { ?inst ?linkType ?fullImage } union { ?inst wdt:P163/wdt:P18 ?fullImage }
                BIND(CONCAT("https://commons.wikimedia.org/w/thumb.php?f=",
                    STRAFTER(STR(?fullImage), "Special:FilePath/"), "&w=200") AS ?image)`,

    linkTypesOfQuery: `
        SELECT ?link (count(distinct ?outObject) as ?outCount) (count(distinct ?inObject) as ?inCount)
        WHERE {
            { \${elementIri} ?link ?outObject .
              # this is to prevent some junk appear on diagram,
              # but can really slow down execution on complex objects
              FILTER ISIRI(?outObject)
              FILTER EXISTS { ?outObject ?someprop ?someobj }
            }
            UNION
            { ?inObject ?link \${elementIri} .
              FILTER ISIRI(?inObject)
              FILTER EXISTS { ?inObject ?someprop ?someobj }
            }
            FILTER regex(STR(?link), "direct")
        } GROUP BY ?link
    `,
    filterRefElementLinkPattern: 'FILTER regex(STR(?link), "direct")',
    filterTypePattern: `?inst wdt:P31 ?instType. ?instType wdt:P279* \${elementTypeIri} . ${'\n'}`,
    filterAdditionalRestriction: `FILTER ISIRI(?inst)
                        BIND(STR(?inst) as ?strInst)
                        FILTER exists {?inst ?someprop ?someobj}
`,
    filterElementInfoPattern: `OPTIONAL {?inst wdt:P31 ?foundClass}
                BIND (coalesce(?foundClass, owl:Thing) as ?class)
                OPTIONAL {?inst rdfs:label ?label}
`,
};

export const OWLRDFSSettings: SparqlDataProviderSettings = {
    defaultPrefix:
        `PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
 PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
 PREFIX owl:  <http://www.w3.org/2002/07/owl#> 
`,
    schemaLabelProperty: 'rdfs:label',
    dataLabelProperty: 'rdfs:label',
    fullTextSearch: {
        prefix: '',
        queryPattern:
        ` OPTIONAL {?inst \${dataLabelProperty} ?search1}
        FILTER regex(COALESCE(str(?search1), str(?extractedLabel)), "\${text}", "i")
        BIND(0 as ?score)
`,
        extractLabel: true,
    },
    classTreeQuery: `
            SELECT ?class ?label ?parent
            WHERE {
                {
                    ?class a rdfs:Class
                } UNION {
                    ?class a owl:Class
                }
                OPTIONAL { ?class rdfs:label ?label.}
                OPTIONAL {?class rdfs:subClassOf ?parent}
            } ORDER BY ?class
        `,        

    // todo: think more, maybe add a limit here?
    linkTypesPattern: `{	?link a rdf:Property
                    } UNION {
                    ?link a owl:ObjectProperty
                }
                BIND('' as ?instcount)
`,
    elementInfoQuery: `
            SELECT ?inst ?class ?label ?propType ?propValue
            WHERE {
                OPTIONAL {?inst rdf:type ?class . }
                OPTIONAL {?inst \${dataLabelProperty} ?label}
                OPTIONAL {?inst ?propType ?propValue.
                FILTER (isLiteral(?propValue)) }
            } VALUES (?inst) {\${ids}}
        `,
    imageQueryPattern: `{ ?inst ?linkType ?image } UNION { [] ?linkType ?inst. BIND(?inst as ?image) }`,
    linkTypesOfQuery: `
        SELECT ?link (count(distinct ?outObject) as ?outCount) (count(distinct ?inObject) as ?inCount) 
        WHERE {
            { \${elementIri} ?link ?outObject FILTER ISIRI(?outObject)}
            UNION 
              { ?inObject ?link \${elementIri} FILTER ISIRI(?inObject)}
        } GROUP BY ?link
    `,
    filterRefElementLinkPattern: '',
    filterTypePattern: `?inst rdf:type \${elementTypeIri} . ${'\n'}`,
    filterElementInfoPattern: `OPTIONAL {?inst rdf:type ?foundClass}
                BIND (coalesce(?foundClass, owl:Thing) as ?class)
                OPTIONAL {?inst \${dataLabelProperty} ?label}`,
    filterAdditionalRestriction: '',
};

const OWLStatsOverride: Partial<SparqlDataProviderSettings> = {
    classTreeQuery: `
        SELECT ?class ?instcount ?label ?parent
        WHERE {
            {SELECT ?class (count(?inst) as ?instcount)
                WHERE {
                    ?inst rdf:type ?class.
                } GROUP BY ?class } UNION
            {
                ?class rdf:type rdfs:Class
            } UNION {
                ?class rdf:type owl:Class
            }
            OPTIONAL { ?class rdfs:label ?label.}
            OPTIONAL {?class rdfs:subClassOf ?parent}
        } ORDERBY ?class
    `,
};

const StardogOverride: Partial<SparqlDataProviderSettings> = {
    fullTextSearch: {
        prefix: 'PREFIX stardog: <tag:stardog:api:>\n',
        queryPattern:
        `?inst rdfs:label ?searchLabel.
        (?searchLabel ?score) stardog:property:textMatch "\${text}".
        `,
        extractLabel: true,
    },

    extractSearchPattern:`
        OPTIONAL {?inst \${dataLabelProperty} ?search1}
        FILTER (COALESCE(str(?search1), str(?extractedLabel)) = "\${text}")
        BIND(0 as ?score).
    `,

    containSearchPattern: `
        OPTIONAL {?inst \${dataLabelProperty} ?search1}
        FILTER regex(COALESCE(str(?search1), str(?extractedLabel)), "\${text}", "i")
        BIND(0 as ?score)
    `,

    fuzzySearchPattern: `
        ?inst rdfs:label ?searchLabel.
        (?searchLabel ?score) stardog:property:textMatch "\${text}~".
    `,

    booleanSearchPattern: `
        ?inst rdfs:label ?searchLabel.
        (?searchLabel ?score) stardog:property:textMatch "\${text}".
    `,
}

export const OWLStatsSettings: SparqlDataProviderSettings = {...OWLRDFSSettings, ...OWLStatsOverride};
export const StardogSettings: SparqlDataProviderSettings = {...OWLRDFSSettings, ...StardogOverride};

const DBPediaOverride: Partial<SparqlDataProviderSettings> = {
    fullTextSearch: {
        prefix: 'PREFIX dbo: <http://dbpedia.org/ontology/>\n',
        queryPattern: ` 
              ?inst rdfs:label ?searchLabel.
              ?searchLabel bif:contains "\${text}".
              ?inst dbo:wikiPageID ?origScore .
              BIND(0-?origScore as ?score)
            `,
    },

    classTreeQuery: `
        SELECT distinct ?class ?label ?parent WHERE {
            ?class rdfs:label ?label.                            
            OPTIONAL {?class rdfs:subClassOf ?parent}
            ?root rdfs:subClassOf owl:Thing.
            ?class rdfs:subClassOf? | rdfs:subClassOf/rdfs:subClassOf ?root
        }
        `,

    elementInfoQuery: `
        SELECT ?inst ?class ?label ?propType ?propValue
        WHERE {
            ?inst rdf:type ?class . 
            ?inst rdfs:label ?label .
            FILTER (!contains(str(?class), 'http://dbpedia.org/class/yago'))
            OPTIONAL {?inst ?propType ?propValue.
            FILTER (isLiteral(?propValue)) }
        } VALUES (?inst) {\${ids}}
        `,
    filterElementInfoPattern: `
        OPTIONAL {?inst rdf:type ?foundClass. FILTER (!contains(str(?foundClass), 'http://dbpedia.org/class/yago'))}
        BIND (coalesce(?foundClass, owl:Thing) as ?class)
        OPTIONAL {?inst \${dataLabelProperty} ?label}`,
    imageQueryPattern: ` { ?inst ?linkType ?fullImage } UNION { [] ?linkType ?inst. BIND(?inst as ?fullImage) }
            BIND(CONCAT("https://commons.wikimedia.org/w/thumb.php?f=",
            STRAFTER(STR(?fullImage), "Special:FilePath/"), "&w=200") AS ?image)
    `,
};
export const DBPediaSettings: SparqlDataProviderSettings = {...OWLRDFSSettings, ...DBPediaOverride};
