import { VIEW_CHARACTERS, SELECT_CHARACTER, UNLOCK_CHARACTER } from '../constants/characterConstants';

const initialState = {
	characters: [],
	character: {}
};

const characterReducer = (state = initialState, action) => {
	const { type, payload } = action;

	switch (type) {
		case VIEW_CHARACTERS:
			return {
				...state,
				characters: payload.data,
			};
		case SELECT_CHARACTER:
			return {
				...state,
				character: payload.data,
			};
		case UNLOCK_CHARACTER:
			return {
				...state,
				characters: payload.data,
			};
		default:
			return state;
	}
}

export default characterReducer;
