import * as React from 'react';
import * as Backbone from 'backbone';

import { Dictionary, ElementModel, LocalizedString } from '../data/model';
import { FilterParams } from '../data/provider';

import { uri2name } from '../diagram/model';
import { DiagramView } from '../diagram/view';

import { ListElementView } from './listElementView';

const DirectionInImage = require<string>('../../../images/direction-in.png');
const DirectionOutImage = require<string>('../../../images/direction-out.png');

export interface FullTextSearchProps {
    className?: string;
    view: DiagramView;
    textCriteria: TextCriteria;
    onTextCriteriaChanged: (textCriteria: TextCriteria) => void;    
}

export interface TextCriteria {
    readonly text?: string;
    readonly elementTypeId?: string;
    readonly refElementId?: string;
    readonly refElementLinkId?: string;
    readonly linkDirection?: 'in' | 'out';
    readonly searchType?: string;
}

export interface State {    
    readonly inputText?: string;
    readonly quering?: boolean;
    readonly resultId?: number;
    readonly error?: any;
    readonly items?: ReadonlyArray<ElementModel>;
    readonly moreItemsAvailable?: boolean;
    readonly selectedItems?: Readonly<Dictionary<boolean>>;
}

const CLASS_NAME = 'ontodia-instances-search';

export class FullTextSearch extends React.Component<FullTextSearchProps, State> {
    private readonly listener = new Backbone.Model();

    private currentRequest: FilterParams;

    constructor(props: FullTextSearchProps) {
        super(props);
        this.state = {
            selectedItems: {},
            resultId: 0,            
        };
    }

    render() {
        const ENTER_KEY_CODE = 13;

        const className = `${CLASS_NAME} stateBasedProgress ${this.props.className || ''}`;
        const progressState =
            this.state.quering ? 'querying' :
            this.state.error ? 'error' :
            this.state.items ? 'finished' : undefined;

        const searchTerm = this.state.inputText === undefined
            ? this.props.textCriteria.text : this.state.inputText;

        return <div className={className} data-state={progressState}>
            <div className='progress'>
                <div className='progress-bar progress-bar-striped active' role='progressbar'
                    aria-valuemin='0' aria-valuemax='100' aria-valuenow='100'
                    style={{width: '100%'}}>
                </div>
            </div>
            <div className={`${CLASS_NAME}__criteria`}>
                
                {this.renderCriteria()}
                <div className={`${CLASS_NAME}__text-criteria input-group`}>
                    <input type='text' className='form-control' placeholder='Search for...'
                        value={searchTerm || ''}
                        onChange={e => this.setState({inputText: e.currentTarget.value})}
                        onKeyUp={e => {
                            if (e.keyCode === ENTER_KEY_CODE) {                               
                               this.submitCriteriaUpdate();
                            }
                        }} />
                    <span className='input-group-btn'>
                        <button className='btn btn-default' type='button' title='Search'
                            onClick={() => this.submitCriteriaUpdate()}>
                            <span className='fa fa-search' aria-hidden='true'></span>
                        </button>
                    </span>                    
                </div>

                <div className={`${CLASS_NAME}__text-criteria input-group`}>
                    <span className={`btn-group ${CLASS_NAME}__language-selector`}>
                        <label><span>Type of search:</span></label>
                        <select defaultValue='1' onChange={this.onChangeSearchType}>
                            <option value='0'>Contain</option>
                            <option value='1'>Fuzzy</option>
                            <option value='2'>Boolean</option>         
                        </select>
                    </span>
                </div>
            </div>
            {/* specify resultId as key to reset scroll position when loaded new search results */}
            <div className={`${CLASS_NAME}__rest`} key={this.state.resultId}>
                {this.renderSearchResults()}
                <div className={`${CLASS_NAME}__rest-end`}>
                    <button type='button' className={`${CLASS_NAME}__load-more btn btn-primary`}
                        disabled={this.state.quering}
                        style={{display: this.state.moreItemsAvailable ? undefined : 'none'}}
                        onClick={() => this.queryItems(true)}>
                        <span className='fa fa-chevron-down' aria-hidden='true' />
                        &nbsp;Show more
                    </button>
                </div>
            </div>            
        </div>;
    }

    private onChangeSearchType = (event: React.SyntheticEvent<HTMLSelectElement>) => {
        const value = event.currentTarget.value;
        this.props.onTextCriteriaChanged({...this.props.textCriteria, searchType: value});
    };

    private renderCriteria(): React.ReactElement<any> {
        const {textCriteria = {}, view} = this.props;
        const criterions: React.ReactElement<any>[] = [];

        if (textCriteria.elementTypeId) {
            const classInfo = view.model.getClassesById(textCriteria.elementTypeId);
            const classLabel = view.getLocalizedText(classInfo.label.values).text;
            criterions.push(<div key='hasType' className={`${CLASS_NAME}__criterion`}>
                {this.renderRemoveCriterionButtons(() => this.props.onTextCriteriaChanged(
                    {...this.props.textCriteria, elementTypeId: undefined}))}
                Has type <span className={`${CLASS_NAME}__criterion-class`}
                    title={classInfo.id}>{classLabel}</span>
            </div>);
        } else if (textCriteria.refElementId) {
            const element = view.model.getElement(textCriteria.refElementId);
            const template = element && element.template;
            const elementLabel = formatLabel(
                view, textCriteria.refElementId, template && template.label);

            const linkType = textCriteria.refElementLinkId && view.model.getLinkType(textCriteria.refElementLinkId);
            const linkTypeLabel = linkType && formatLabel(view, linkType.id, linkType.label);

            criterions.push(<div key='hasLinkedElement' className={`${CLASS_NAME}__criterion`}>
                {this.renderRemoveCriterionButtons(() => this.props.onTextCriteriaChanged(
                    {...this.props.textCriteria, refElementId: undefined, refElementLinkId: undefined}))}
                Connected to <span className={`${CLASS_NAME}__criterion-element`}
                    title={element && element.id}>{elementLabel}</span>
                {textCriteria.refElementLinkId && <span>
                    {' through '}
                    <span className={`${CLASS_NAME}__criterion-link-type`}
                        title={linkType && linkType.id}>{linkTypeLabel}</span>
                    {textCriteria.linkDirection === 'in' && <span>
                        {' as '}<img className={`${CLASS_NAME}__link-direction`} src={DirectionInImage} />&nbsp;source
                    </span>}
                    {textCriteria.linkDirection === 'out' && <span>
                        {' as '}<img className={`${CLASS_NAME}__link-direction`} src={DirectionOutImage} />&nbsp;target
                    </span>}
                </span>}
            </div>);
        }

        return <div className={`${CLASS_NAME}__criterions`}>{criterions}</div>;
    }

    private renderRemoveCriterionButtons(onClick: () => void) {
        return <div className={`${CLASS_NAME}__criterion-remove btn-group btn-group-xs`}>
            <button type='button' className='btn btn-default' title='Remove criteria' onClick={onClick}>
                <span className='fa fa-times' aria-hidden='true'></span>
            </button>
        </div>;
    }

    private renderSearchResults(): React.ReactElement<any> {
        const items = this.state.items || [];
        return <ul className={`${CLASS_NAME}__results`}>
            {items.map((model, index) => <ListElementView key={index}
                model={model}
                view={this.props.view}
                disabled={Boolean(this.props.view.model.getElement(model.id))}
                selected={this.state.selectedItems[model.id] || false}
                onClick={() => this.setState({
                    selectedItems: {
                        ...this.state.selectedItems,
                        [model.id]: !this.state.selectedItems[model.id],
                    },
                })}
                onDragStart={e => {
                    const elementIds = Object.keys({...this.state.selectedItems, [model.id]: true});
                    try {
                        e.dataTransfer.setData('application/x-ontodia-elements', JSON.stringify(elementIds));
                    } catch (ex) { // IE fix
                        e.dataTransfer.setData('text', JSON.stringify(elementIds));
                    }
                    return false;
                }} />,
            )}
        </ul>;
    }

    private submitCriteriaUpdate() {
        let text = this.state.inputText === undefined ? this.props.textCriteria.text : this.state.inputText;
        text = text === '' ? undefined : text;
        this.props.onTextCriteriaChanged({...this.props.textCriteria, text});
    }

    componentDidMount() {
        this.listener.listenTo(this.props.view, 'change:language', () => this.forceUpdate());
        this.listener.listenTo(this.props.view.model.cells, 'add remove reset', () => {
            const selectedItems: Dictionary<boolean> = {...this.state.selectedItems};
            for (const id of Object.keys(selectedItems)) {
                if (selectedItems[id] && this.props.view.model.getElement(id)) {
                    delete selectedItems[id];
                }
            }
            this.setState({selectedItems});
        });
        this.queryItems(false);
    }

    componentWillReceiveProps(nextProps: FullTextSearchProps) {
        const languageChanged = this.currentRequest
            ? this.currentRequest.languageCode !== nextProps.view.getLanguage() : false;

        if (this.props.textCriteria !== nextProps.textCriteria || languageChanged) {
            this.setState({inputText: undefined}, () => this.queryItems(false));
        }
    }

    componentWillUnmount() {
        this.listener.stopListening();
        this.currentRequest = undefined;
    }

    private queryItems(loadMoreItems: boolean) {        
        let request: FilterParams;
        if (loadMoreItems) {
            if (!this.currentRequest) {
                throw new Error('Cannot request more items without initial request.');
            }
            const {offset, limit} = this.currentRequest;
            request = {...this.currentRequest, offset: offset + limit};
        } else {
            request = createRequest(this.props.textCriteria, this.props.view.getLanguage());            
        }

        if (!(request.text || request.elementTypeId || request.refElementId || request.refElementLinkId)) {
            this.setState({
                quering: false,
                error: undefined,
                items: undefined,
                moreItemsAvailable: false,
                selectedItems: {},
            });
            return;
        }

        this.currentRequest = request;
        this.setState({
            quering: true,
            error: undefined,
            moreItemsAvailable: false,
        });    

        this.props.view.model.dataProvider.filter(request).then(elements => {
            if (this.currentRequest !== request) { return; }
            this.processFilterData(elements);
        }).catch(error => {
            if (this.currentRequest !== request) { return; }
            console.error(error);
            this.setState({error});
        });
    }

    private processFilterData(elements: Dictionary<ElementModel>) {
        const selectedItems: Dictionary<boolean> = {...this.state.selectedItems};

        const newItems: ElementModel[] = [];
        for (const elementId in elements) {
            if (!elements.hasOwnProperty(elementId)) { continue; }

            let element = elements[elementId];
            newItems.push(element);

            delete selectedItems[element.id];
        }

        const requestedAdditionalItems = this.currentRequest.offset > 0;
        const items = requestedAdditionalItems
            ? this.state.items.concat(newItems) : newItems;

        let resultId = this.state.resultId;
        if (!requestedAdditionalItems) { resultId += 1; }

        this.setState({
            quering: false,
            resultId,
            items,
            error: undefined,
            moreItemsAvailable: newItems.length >= this.currentRequest.limit,
            selectedItems,
        });
    }
}

function createRequest(criteria: TextCriteria, language: string): FilterParams {
    return {
        text: criteria.text,
        elementTypeId: criteria.elementTypeId,
        refElementId: criteria.refElementId,
        refElementLinkId: criteria.refElementLinkId,
        linkDirection: criteria.linkDirection,
        offset: 0,
        limit: 100,
        languageCode: language ? language : 'en',
        searchType: criteria.searchType,
    };
}

function formatLabel(view: DiagramView, uri: string, label?: { values: LocalizedString[] }) {
    return label ? view.getLocalizedText(label.values).text : uri2name(uri);
}