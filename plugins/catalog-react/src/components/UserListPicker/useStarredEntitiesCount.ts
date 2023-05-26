/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { QueryEntitiesInitialRequest } from '@backstage/catalog-client';
import { parseEntityRef, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { compact, isEqual } from 'lodash';
import { useMemo, useRef } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { catalogApiRef } from '../../api';
import { EntityUserListFilter } from '../../filters';
import { useEntityList, useStarredEntities } from '../../hooks';
import { reduceCatalogFilters } from '../../utils';

export function useStarredEntitiesCount() {
  const catalogApi = useApi(catalogApiRef);
  const { filters } = useEntityList();
  const { starredEntities } = useStarredEntities();

  const prevRequest = useRef<QueryEntitiesInitialRequest>();
  const request = useMemo(() => {
    const { user, ...allFilters } = filters;
    const compacted = compact(Object.values(allFilters));
    const filter = reduceCatalogFilters(compacted);

    const facet = 'metadata.name';

    const newRequest: QueryEntitiesInitialRequest = {
      filter: {
        ...filter,
        [facet]: Array.from(starredEntities).map(e => parseEntityRef(e).name),
      },
      limit: 1000,
    };
    if (isEqual(newRequest, prevRequest.current)) {
      return prevRequest.current;
    }
    prevRequest.current = newRequest;

    return newRequest;
  }, [filters, starredEntities]);

  const { value: count, loading } = useAsync(async () => {
    if (!starredEntities.size) {
      return 0;
    }

    const response = await catalogApi.queryEntities(request);

    return response.items
      .map(e =>
        stringifyEntityRef({
          kind: e.kind,
          namespace: e.metadata.namespace,
          name: e.metadata.name,
        }),
      )
      .filter(e => starredEntities.has(e)).length;
  }, [request, starredEntities]);

  const filter = useMemo(
    () => EntityUserListFilter.starred(Array.from(starredEntities)),
    [starredEntities],
  );

  return { count, loading, filter };
}
