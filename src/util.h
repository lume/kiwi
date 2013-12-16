/*------------------------------------------------------------------------------
| Copyright (c) 2013, Nucleic Development Team.
|
| Distributed under the terms of the Modified BSD License.
|
| The full license is in the file COPYING.txt, distributed with this software.
|-----------------------------------------------------------------------------*/
#pragma once


namespace kiwi
{

namespace impl
{

inline bool approx( double a, double b )
{
	const double eps = 1.0e-8;
	return ( a > b ) ? ( a - b ) < eps : ( b - a ) < eps;
}

} // namespace impl

} // namespace