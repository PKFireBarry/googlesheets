from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from langchain_core.messages import (
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
	ToolMessage,
)

logger = logging.getLogger(__name__)

MODELS_WITHOUT_TOOL_SUPPORT_PATTERNS = [
	'deepseek-reasoner',
	'deepseek-r1',
	'.*gemma.*-it',
]


def is_model_without_tool_support(model_name: str) -> bool:
	return any(re.match(pattern, model_name) for pattern in MODELS_WITHOUT_TOOL_SUPPORT_PATTERNS)


def extract_json_from_model_output(content: str) -> dict:
	"""Extract JSON from model output with robust parsing and multiple fallback strategies."""
	original_content = content
	
	try:
		# Strategy 1: Try direct JSON parsing first (fastest path)
		try:
			result_dict = json.loads(content.strip())
			if isinstance(result_dict, dict):
				return _validate_and_fix_result(result_dict)
		except json.JSONDecodeError:
			pass
		
		# Strategy 2: Extract from markdown code blocks
		content = _extract_from_code_blocks(content)
		if content != original_content:
			try:
				result_dict = json.loads(content.strip())
				if isinstance(result_dict, dict):
					return _validate_and_fix_result(result_dict)
			except json.JSONDecodeError:
				pass
		
		# Strategy 3: Find JSON object using regex patterns
		content = _extract_json_with_regex(original_content)
		if content:
			try:
				result_dict = json.loads(content)
				if isinstance(result_dict, dict):
					return _validate_and_fix_result(result_dict)
			except json.JSONDecodeError:
				pass
		
		# Strategy 4: Clean and fix common JSON formatting issues
		content = _fix_common_json_issues(original_content)
		if content:
			try:
				result_dict = json.loads(content)
				if isinstance(result_dict, dict):
					return _validate_and_fix_result(result_dict)
			except json.JSONDecodeError:
				pass
		
		# Strategy 5: Extract partial JSON and attempt reconstruction
		content = _extract_partial_json(original_content)
		if content:
			try:
				result_dict = json.loads(content)
				if isinstance(result_dict, dict):
					return _validate_and_fix_result(result_dict)
			except json.JSONDecodeError:
				pass
		
		# If all strategies fail, log the content and raise error
		logger.warning(f'All JSON extraction strategies failed for content: {original_content[:200]}...')
		raise ValueError('Could not parse response.')
		
	except Exception as e:
		logger.warning(f'Failed to parse model output: {original_content[:200]}... Error: {str(e)}')
		raise ValueError('Could not parse response.')


def _extract_from_code_blocks(content: str) -> str:
	"""Extract JSON from markdown code blocks."""
	# Pattern for ```json ... ``` or ``` ... ```
	code_block_patterns = [
		r'```(?:json)?\s*(.*?)\s*```',
		r'`(.*?)`',  # Single backticks
	]
	
	for pattern in code_block_patterns:
		matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
		if matches:
			# Take the longest match (most likely to be complete JSON)
			longest_match = max(matches, key=len)
			if longest_match.strip():
				return longest_match.strip()
	
	return content


def _extract_json_with_regex(content: str) -> str | None:
	"""Extract JSON using various regex patterns."""
	# Pattern 1: Find complete JSON object from { to matching }
	brace_pattern = r'\{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*\}'
	matches = re.findall(brace_pattern, content, re.DOTALL)
	
	for match in matches:
		# Validate that this looks like a proper JSON object
		if _looks_like_json(match):
			return match.strip()
	
	# Pattern 2: Find JSON between specific markers or text
	json_markers = [
		r'(?:response|result|output|json):\s*(\{.*?\})',
		r'(\{[^{}]*"current_state"[^{}]*\})',  # Look for AgentOutput structure
		r'(\{[^{}]*"action"[^{}]*\})',  # Look for action structure
	]
	
	for pattern in json_markers:
		matches = re.findall(pattern, content, re.DOTALL | re.IGNORECASE)
		if matches:
			for match in matches:
				if _looks_like_json(match):
					return match.strip()
	
	return None


def _fix_common_json_issues(content: str) -> str | None:
	"""Fix common JSON formatting issues."""
	# Remove common prefixes/suffixes
	content = re.sub(r'^[^{]*', '', content)  # Remove everything before first {
	content = re.sub(r'[^}]*$', '', content)  # Remove everything after last }
	
	if not content.strip():
		return None
	
	# Fix common issues
	fixes = [
		# Fix trailing commas
		(r',(\s*[}\]])', r'\1'),
		# Fix missing quotes around keys
		(r'(\w+):', r'"\1":'),
		# Fix single quotes to double quotes
		(r"'([^']*)'", r'"\1"'),
		# Fix escaped quotes issues
		(r'\\"', '"'),
		# Fix newlines in strings
		(r'"\s*\n\s*"', ''),
	]
	
	for pattern, replacement in fixes:
		content = re.sub(pattern, replacement, content)
	
	return content.strip() if content.strip() else None


def _extract_partial_json(content: str) -> str | None:
	"""Extract and reconstruct partial JSON."""
	# Look for key JSON components
	current_state_match = re.search(r'"current_state"\s*:\s*\{[^{}]*\}', content, re.DOTALL)
	action_match = re.search(r'"action"\s*:\s*\[[^\]]*\]', content, re.DOTALL)
	
	if current_state_match and action_match:
		# Reconstruct basic JSON structure
		reconstructed = f'{{{current_state_match.group()}, {action_match.group()}}}'
		return reconstructed
	
	return None


def _looks_like_json(text: str) -> bool:
	"""Check if text looks like valid JSON structure."""
	text = text.strip()
	if not (text.startswith('{') and text.endswith('}')):
		return False
	
	# Basic validation - should contain quotes and colons
	if '"' not in text or ':' not in text:
		return False
	
	# Check for balanced braces
	brace_count = text.count('{') - text.count('}')
	if brace_count != 0:
		return False
	
	return True


def _validate_and_fix_result(result_dict: dict) -> dict:
	"""Validate and fix the extracted result dictionary."""
	# Handle case where models return a list with one dict
	if isinstance(result_dict, list) and len(result_dict) == 1 and isinstance(result_dict[0], dict):
		result_dict = result_dict[0]
	
	if not isinstance(result_dict, dict):
		raise ValueError(f'Expected JSON dictionary in response, got JSON {type(result_dict)} instead')
	
	# Ensure required fields exist with defaults if missing
	if 'current_state' not in result_dict:
		result_dict['current_state'] = {
			'page_summary': 'Unknown',
			'evaluation_previous_goal': 'Unknown',
			'memory': 'Unknown',
			'next_goal': 'Unknown'
		}
	
	if 'action' not in result_dict:
		result_dict['action'] = []
	
	# Ensure action is a list
	if not isinstance(result_dict['action'], list):
		result_dict['action'] = [result_dict['action']]
	
	return result_dict


def convert_input_messages(input_messages: list[BaseMessage], model_name: str | None) -> list[BaseMessage]:
	"""Convert input messages to a format that is compatible with the planner model"""
	if model_name is None:
		return input_messages

	# TODO: use the auto-detected tool calling method from Agent._set_tool_calling_method(),
	# or abstract that logic out to reuse so we can autodetect the planner model's tool calling method as well
	if is_model_without_tool_support(model_name):
		converted_input_messages = _convert_messages_for_non_function_calling_models(input_messages)
		merged_input_messages = _merge_successive_messages(converted_input_messages, HumanMessage)
		merged_input_messages = _merge_successive_messages(merged_input_messages, AIMessage)
		return merged_input_messages
	return input_messages


def _convert_messages_for_non_function_calling_models(input_messages: list[BaseMessage]) -> list[BaseMessage]:
	"""Convert messages for non-function-calling models"""
	output_messages = []
	for message in input_messages:
		if isinstance(message, HumanMessage):
			output_messages.append(message)
		elif isinstance(message, SystemMessage):
			output_messages.append(message)
		elif isinstance(message, ToolMessage):
			output_messages.append(HumanMessage(content=message.content))
		elif isinstance(message, AIMessage):
			# check if tool_calls is a valid JSON object
			if message.tool_calls:
				tool_calls = json.dumps(message.tool_calls)
				output_messages.append(AIMessage(content=tool_calls))
			else:
				output_messages.append(message)
		else:
			raise ValueError(f'Unknown message type: {type(message)}')
	return output_messages


def _merge_successive_messages(messages: list[BaseMessage], class_to_merge: type[BaseMessage]) -> list[BaseMessage]:
	"""Some models like deepseek-reasoner dont allow multiple human messages in a row. This function merges them into one."""
	merged_messages = []
	streak = 0
	for message in messages:
		if isinstance(message, class_to_merge):
			streak += 1
			if streak > 1:
				if isinstance(message.content, list):
					merged_messages[-1].content += message.content[0]['text']  # type:ignore
				else:
					merged_messages[-1].content += message.content
			else:
				merged_messages.append(message)
		else:
			merged_messages.append(message)
			streak = 0
	return merged_messages


def save_conversation(input_messages: list[BaseMessage], response: Any, target: str, encoding: str | None = None) -> None:
	"""Save conversation history to file."""

	# create folders if not exists
	if dirname := os.path.dirname(target):
		os.makedirs(dirname, exist_ok=True)

	with open(
		target,
		'w',
		encoding=encoding,
	) as f:
		_write_messages_to_file(f, input_messages)
		_write_response_to_file(f, response)


def _write_messages_to_file(f: Any, messages: list[BaseMessage]) -> None:
	"""Write messages to conversation file"""
	for message in messages:
		f.write(f' {message.__class__.__name__} \n')

		if isinstance(message.content, list):
			for item in message.content:
				if isinstance(item, dict) and item.get('type') == 'text':
					f.write(item['text'].strip() + '\n')
		elif isinstance(message.content, str):
			try:
				content = json.loads(message.content)
				f.write(json.dumps(content, indent=2) + '\n')
			except json.JSONDecodeError:
				f.write(message.content.strip() + '\n')

		f.write('\n')


def _write_response_to_file(f: Any, response: Any) -> None:
	"""Write model response to conversation file"""
	f.write(' RESPONSE\n')
	f.write(json.dumps(json.loads(response.model_dump_json(exclude_unset=True)), indent=2))
