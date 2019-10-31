import { stringify } from 'qs';
import merge from 'deepmerge';
import axios from 'axios';
import {
  GET_LIST,
  GET_ONE,
  CREATE,
  UPDATE,
  DELETE,
  GET_MANY,
  GET_MANY_REFERENCE,
} from './actions';

import defaultSettings from './default-settings';
import { NotImplementedError } from './errors';
import init from './initializer';

// Set HTTP interceptors.
init();

/**
 * Maps react-admin queries to a JSONAPI REST API
 *
 * @param {string} apiUrl the base URL for the JSONAPI
 * @param {string} userSettings Settings to configure this client.
 *
 * @param {string} type Request type, e.g GET_LIST
 * @param {string} resource Resource name, e.g. "posts"
 * @param {Object} payload Request parameters. Depends on the request type
 * @returns {Promise} the Promise for a data response
 */
export default (apiUrl, userSettings = {}) => (type, resource, params) => {
  let url = '';
  const settings = merge(defaultSettings, userSettings);

  const options = {
    headers: settings.headers,
  };

  console.log('request', 'type:', type, 'resource:', resource, 'params:', params);

  switch (type) {
    case GET_LIST: {
      const { page, perPage } = params.pagination;

      // Create query with pagination params.
      const query = {
        'page[number]': page,
        'page[size]': perPage,
      };

      // Add all filter params to query.
      // let filter = false;
      Object.keys(params.filter || {}).forEach((key) => {
        // query[`filter[${key}]`] = params.filter[key];
        query['filter'] = `[{"name":"${key}","op":"like","val":"${params.filter[key]}%"}]`;
        // query[`filter[{"name":"name","op":"like","val":"birth_date"}]`]
      });
      console.log(query);
      // /persons?filter=[{"name":"name","op":"eq","field":"birth_date"}] HTTP/1.1
      // "op":"ilike"

      // Add sort parameter
      if (params.sort && params.sort.field) {
        const prefix = params.sort.order === 'ASC' ? '' : '-';
        query.sort = `${prefix}${params.sort.field}`;
      }

      url = `${apiUrl}/${resource}?${stringify(query)}`;
      console.log(url);
      break;
    }

    case GET_ONE:
      url = `${apiUrl}/${resource}/${params.id}`;
      break;

    case CREATE:
      url = `${apiUrl}/${resource}`;
      options.method = 'POST';
      options.data = JSON.stringify({
        data: { type: resource, attributes: params.data },
      });
      break;

    case UPDATE: {
      url = `${apiUrl}/${resource}/${params.id}`;

      let { relationships, id, ..._data } = params.data;

      // relationships[key].ids = relationships[key].data.id || relationships[key].data.map(_data => _data.id);

      Object.keys(relationships || {}).forEach((key) => {
        console.log(relationships[key]);
        if(relationships[key].many) {
          console.log('mane');
          relationships[key].data = relationships[key].ids.map(id => ({type: key, id: id}))
        } else{
          relationships[key].data = {
            type: key,
            id: relationships[key].ids
          }
        }

        // delete relationships[key].links
        delete relationships[key].ids
        delete relationships[key].many
      })
      console.log('relationships', relationships, ',data:', _data);

      const data = {
        data: {
          id: params.id,
          type: resource,
          attributes: _data,
          relationships: relationships,
        },
      };

      console.log('case: ', type, resource, data);
      options.method = settings.updateMethod;
      options.data = JSON.stringify(data);
      break;
    }

    case DELETE:
      url = `${apiUrl}/${resource}/${params.id}`;
      options.method = 'DELETE';
      break;

    case GET_MANY: {
      console.log(params);
      // const query = {
      //   filter: JSON.stringify({ id: params.ids }),
      // };
      // url = `${apiUrl}/${resource}?${stringify(query)}`;
      // break;

      // const { ids } = params;
      //
      // const query = ids.map(id => `filter[id]=${id}`).join('&');
      // url = `${apiUrl}/${resource}?${query}`;
      // console.log(params, ids, query, url);
      // break;

      const { ids } = params;

      // const query = ids.map(id => `filter[id]=${id}`).join('&');
      console.log(`"${ids.map(id => id.id || id).filter(id => id ? true : false).join('","')}"`);
      const query = `filter=[{"name":"id", "op":"in_", "val":["${ids.map(id => id.id || id).filter(id => id ? true : false).join('","')}"]}]`
      url = `${apiUrl}/${resource}?${query}`;
      console.log(params, ids, query, url);
      break;

    }

    case GET_MANY_REFERENCE: {
      const { page, perPage } = params.pagination;

      // Create query with pagination params.
      const query = {
        'page[number]': page,
        'page[size]': perPage,
      };

      // Add all filter params to query.
      Object.keys(params.filter || {}).forEach((key) => {
        query[`filter[${key}]`] = params.filter[key];
      });

      query[`filter[${key}]`] = params.filter[key];
      console.log(query);

      // Add the reference id to the filter params.
      query[`filter[${params.target}]`] = params.id;

      url = `${apiUrl}/${resource}?${stringify(query)}`;
      break;
    }

    default:
      throw new NotImplementedError(`Unsupported Data Provider request type ${type}`);
  }

  return axios({ url, ...options })
    .then((response) => {
      console.log('response', type, response.data.data);
      switch (type) {
        case GET_MANY:
        case GET_LIST: {
          const data = response.data.data.map(value => {

            const relationships = value.relationships
            Object.keys(relationships || {}).forEach((key) => {
              if(relationships[key].data != null) {
                // check if data is single object (with id param) or else array of objects
                relationships[key].ids = relationships[key].data.id || relationships[key].data.map(_data => _data.id);
                relationships[key].many = relationships[key].data.id ? false : true;
              }else{
                relationships[key].ids = '';
                relationships[key].many = false;
              }
              delete relationships[key].data
              delete relationships[key].links
            })

            return Object.assign(
              { id: value.id },
              value.attributes,
              { relationships: relationships },
            )});
          console.log(type, 'data: ', data);
          return {
            data,
            total: response.data.meta[settings.total],
          };
        }

        // case GET_MANY_REFERENCE: {
        //   return {
        //     data: response.data.data.map(value => Object.assign(
        //       { id: value.id },
        //       value.attributes,
        //       // { relationships: value.relationships },
        //     )),
        //     total: response.data.meta[settings.total],
        //   };
        // }

        case GET_MANY_REFERENCE: {
          const rawdata = response.data.data;
          const data = rawdata.map(e => ({ ...e.attributes, id: e.id }));
          console.log(type, 'data: ', data);
          return {
            data,
            total: data.length,
          };
        }

        case GET_ONE: {
          const { id, attributes, relationships } = response.data.data;

          Object.keys(relationships || {}).forEach((key) => {
            if(relationships[key].data != null) {
              // check if data is single object (with id param) or else array of objects
              relationships[key].ids = relationships[key].data.id || relationships[key].data.map(_data => _data.id);
              relationships[key].many = relationships[key].data.id ? false : true;
            }
            delete relationships[key].data
            delete relationships[key].links
          })
          const data = {
            id, ...attributes, relationships
          }
          console.log(type, 'data: ', data);

          return {
            data,
          };
        }

        case CREATE: {
          const { id, attributes } = response.data.data;

          return {
            data: {
              id, ...attributes,
            },
          };
        }

        case UPDATE: {
          const { id, attributes } = response.data.data;

          return {
            data: {
              id, ...attributes,
            },
          };
        }

        case DELETE: {
          return {
            data: { id: params.id },
          };
        }

        default:
          throw new NotImplementedError(`Unsupported Data Provider request type ${type}`);
      }
    });
};
